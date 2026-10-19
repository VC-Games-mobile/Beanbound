import unittest
from report import summarize


class ReportTests(unittest.TestCase):
    def test_downloads_separate_types_dates_and_apps(self):
        rows = [
            {'Date': '2026-10-17', 'App Apple Identifier': '6818844668', 'Counts': '3', 'Download Type': 'First-time download'},
            {'Date': '2026-10-17', 'App Apple Identifier': '6818844668', 'Counts': '2', 'Download Type': 'Redownload'},
            {'Date': '2026-10-16', 'App Apple Identifier': '6818844668', 'Counts': '99', 'Download Type': 'Redownload'},
            {'Date': '2026-10-18', 'App Apple Identifier': 'other', 'Counts': '99', 'Download Type': 'Redownload'},
        ]
        text = summarize('App Downloads Standard', rows, '6818844668')
        self.assertIn('2026-10-17', text)
        self.assertIn('First-time download: 3', text)
        self.assertIn('Redownload: 2', text)
        self.assertNotIn('99', text)

    def test_only_product_page_views_count(self):
        rows = [{'Date': '2026-10-17', 'App Apple Identifier': '6818844668',
                 'Counts': count, 'Event': event, 'Page Type': page}
                for count, event, page in [('4', 'Impression', 'No page'),
                                           ('2', 'Page view', 'Product page'),
                                           ('8', 'Page view', 'Developer page')]]
        text = summarize('App Store Discovery and Engagement Standard', rows, '6818844668')
        self.assertIn('Impressions: 4; product page views: 2', text)

    def test_unavailable_is_not_zero(self):
        self.assertEqual(summarize('App Sessions Standard', [], '6818844668'),
                         'No report data available yet.')

    def test_sessions_not_unique_devices(self):
        row = {'Date': '2026-10-17', 'App Apple Identifier': '6818844668', 'Sessions': '12', 'Unique Devices': '5'}
        self.assertIn('Sessions: 12', summarize('App Sessions Standard', [row], '6818844668'))


if __name__ == '__main__':
    unittest.main()
