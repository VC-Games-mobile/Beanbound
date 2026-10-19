"""Post Beanbound's Apple-provided aggregate reports to its Discord channel."""
import argparse
import csv
import datetime as dt
import fcntl
import gzip
import io
import json
from pathlib import Path
import time
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import jwt
import requests

CONFIG = Path.home() / '.config/beanbound-analytics'
API = 'https://api.appstoreconnect.apple.com/v1'
NAMES = ['App Downloads Standard', 'App Store Discovery and Engagement Standard', 'App Sessions Standard']


def save(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n')
    temp.chmod(0o600)
    temp.replace(path)


class Apple:
    def __init__(self, config):
        now = int(time.time())
        token = jwt.encode({'iss': config['issuer_id'], 'iat': now, 'exp': now + 1200,
                            'aud': 'appstoreconnect-v1'},
                           Path(config['private_key_path']).read_text(), algorithm='ES256',
                           headers={'kid': config['key_id'], 'typ': 'JWT'})
        self.session = requests.Session()
        self.session.headers['Authorization'] = 'Bearer ' + token

    def rows(self, url, params=None):
        result = []
        while url:
            if urlparse(url).netloc != 'api.appstoreconnect.apple.com':
                raise ValueError('Unexpected Apple API host')
            response = self.session.get(url, params=params, timeout=45)
            if response.status_code != 200:
                raise RuntimeError(f'Apple API HTTP {response.status_code}')
            data = response.json()
            result.extend(data['data'])
            url, params = data.get('links', {}).get('next'), None
        return result

    def report(self, report_id):
        instances = self.rows(f'{API}/analyticsReports/{report_id}/instances',
                              {'filter[granularity]': 'DAILY', 'limit': 200})
        if not instances:
            return []
        # Each instance is a batch; download every segment. Later batches can
        # contain late events, so never sum multiple processing snapshots blindly.
        latest = max(instances, key=lambda x: (x['attributes']['processingDate'], x['id']))
        segments = self.rows(f"{API}/analyticsReportInstances/{latest['id']}/segments")
        result = []
        for segment in segments:
            url = segment['attributes']['url']
            if urlparse(url).scheme != 'https':
                raise ValueError('Report download is not HTTPS')
            # Signed download URLs receive no App Store Connect bearer token.
            response = requests.get(url, timeout=60)
            if response.status_code != 200:
                raise RuntimeError(f'Report download HTTP {response.status_code}')
            raw = response.content
            if raw.startswith(b'\x1f\x8b'):
                raw = gzip.decompress(raw)
            result.extend(csv.DictReader(io.StringIO(raw.decode('utf-8-sig')), delimiter='\t'))
        return result


def summarize(name, rows, app_id):
    rows = [r for r in rows if r.get('App Apple Identifier') == app_id]
    if not rows:
        return 'No report data available yet.'
    if any('Date' not in r or 'Counts' not in r for r in rows) and name != 'App Sessions Standard':
        raise ValueError(f'Unexpected report columns for {name}')
    day = max(r['Date'] for r in rows)
    rows = [r for r in rows if r['Date'] == day]
    def total(items, key='Counts'):
        return sum(int(r[key]) for r in items)
    if name == 'App Downloads Standard':
        groups = {}
        for r in rows:
            label = r['Download Type']
            groups[label] = groups.get(label, 0) + int(r['Counts'])
        text = '; '.join(f'{k}: {v:,}' for k, v in sorted(groups.items()))
    elif name == 'App Store Discovery and Engagement Standard':
        impressions = total([r for r in rows if r['Event'].lower() == 'impression'])
        views = total([r for r in rows if r['Event'].lower() == 'page view' and r['Page Type'].lower() == 'product page'])
        text = f'Impressions: {impressions:,}; product page views: {views:,}'
    else:
        count = total(rows, 'Sessions')
        text = f'Sessions: {count:,}'
    return f'{day} — {text}'


def run(send=False):
    today = dt.datetime.now(ZoneInfo('America/Detroit')).date().isoformat()
    state_path = CONFIG / 'state.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    if send and state.get('last_post_date') == today:
        print('Already posted today; skipped.')
        return
    config = json.loads((CONFIG / 'apple.json').read_text())
    request = json.loads((CONFIG / 'report-request.json').read_text())
    apple = Apple(config)
    reports = apple.rows(f"{API}/analyticsReportRequests/{request['request_id']}/reports", {'limit': 200})
    by_name = {r['attributes']['name']: r for r in reports}
    summaries = []
    for name in NAMES:
        data = apple.report(by_name[name]['id']) if name in by_name else []
        summaries.append((name, summarize(name, data, config['app_id'])))
    message = f'🌱 **Beanbound Analytics — {today}**\n' + '\n'.join(
        f'**{name.removesuffix(" Standard")}**\n{text}' for name, text in summaries)
    message += '\n\nLatest available daily data from Apple; dates may differ and recent figures may change. Missing data is not zero. Usage reports cover eligible opted-in users.\n<https://appstoreconnect.apple.com/apps/6818844668/analytics>'
    if send:
        discord = json.loads((CONFIG / 'discord.json').read_text())
        response = requests.post(discord['webhook_url'], params={'wait': 'true'},
                                 json={'content': message, 'allowed_mentions': {'parse': []}}, timeout=30)
        if response.status_code != 200:
            raise RuntimeError(f'Discord HTTP {response.status_code}; not marked sent')
        receipt = response.json()
        if receipt.get('channel_id') != discord['channel_id']:
            raise RuntimeError('Unexpected Discord channel')
        save(state_path, {'last_post_date': today, 'message_id': receipt['id'], 'summaries': summaries})
        print(f'Delivered daily summary for {today}.')
    else:
        print(message)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--send', action='store_true')
    args = parser.parse_args()
    with (CONFIG / 'run.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            run(args.send)
        except Exception as error:
            # Avoid printing signed URLs, tokens, private keys, or request headers.
            print(f'Analytics run failed ({type(error).__name__}).')
            raise SystemExit(1)
