import AVFoundation

/// Native polyphonic synth for the game's procedural music and pickup sounds.
final class GameAudio {
    private let engine=AVAudioEngine()
    private let lock=NSLock()
    private struct Voice {
        var frequency:Double, frequencyStep:Double, duration:Double, wave:Int, volume:Double, attack:Double
        var decayStep:Double, envelope:Double=1
        var delay:Double, time:Double=0, phase:Double=0
    }
    private var voices:[Voice]=[]
    private var pending:[Voice]=[]
    private var shouldSilence=false
    private var source:AVAudioSourceNode?
    init() {
        try? AVAudioSession.sharedInstance().setCategory(.playback)
        try? AVAudioSession.sharedInstance().setActive(true)
        let rate=44100.0
        let format=AVAudioFormat(standardFormatWithSampleRate:rate,channels:2)!
        let node=AVAudioSourceNode { [weak self] _,_,count,buffers in
            let list=UnsafeMutableAudioBufferListPointer(buffers)
            guard let self else { return noErr }
            self.lock.lock()
            let pending=self.pending;self.pending.removeAll(keepingCapacity:true)
            let silence=self.shouldSilence;self.shouldSilence=false
            self.lock.unlock()
            if silence {self.voices.removeAll(keepingCapacity:true)}
            self.voices.append(contentsOf:pending)
            if self.voices.count>48 {self.voices.removeFirst(self.voices.count-48)}
            for frame in 0..<Int(count) {
                var sample=0.0
                for i in self.voices.indices {
                    if self.voices[i].delay>0 {self.voices[i].delay-=1/rate;continue}
                    let v=self.voices[i]
                    if v.time>=v.duration {continue}
                    let envelope=v.attack>0 && v.time<v.attack ? v.time/v.attack : v.envelope
                    let phase=v.phase
                    let value:Double
                    switch v.wave {
                    case 1:value=1-4*abs(phase-0.5)
                    case 2:value=phase<0.5 ? 1 : -1
                    case 3:value=2*phase-1
                    default:value=sin(phase*2*Double.pi)
                    }
                    sample+=value*v.volume*envelope
                    self.voices[i].phase+=v.frequency/rate
                    if self.voices[i].phase>=1 {self.voices[i].phase-=floor(self.voices[i].phase)}
                    self.voices[i].frequency*=v.frequencyStep
                    if v.time>=v.attack {self.voices[i].envelope*=v.decayStep}
                    self.voices[i].time+=1/rate
                }
                let out=Float(max(-0.9,min(0.9,sample)))
                for b in list {b.mData?.assumingMemoryBound(to:Float.self)[frame]=out}
            }
            self.voices.removeAll{$0.time >= $0.duration}
            return noErr
        }
        source=node;engine.attach(node);engine.connect(node,to:engine.mainMixerNode,format:format)
        try? engine.start()
    }
    func tone(_ f:Double,_ end:Double,_ duration:Double,_ wave:String,_ volume:Double,_ attack:Double,_ delay:Double) {
        lock.lock();defer{lock.unlock()}
        let duration=min(8,max(0.01,duration)),rate=44100.0
        let kind=["triangle":1,"square":2,"sawtooth":3][wave] ?? 0
        if pending.count<48 {pending.append(Voice(frequency:max(1,f),frequencyStep:pow(max(1,end)/max(1,f),1/(rate*duration)),duration:duration,wave:kind,volume:min(0.2,max(0,volume)),attack:attack,decayStep:pow(0.0001,1/(rate*max(0.01,duration-attack))),delay:delay))}
    }
    func silence(){lock.lock();pending.removeAll(keepingCapacity:true);shouldSilence=true;lock.unlock()}
}
