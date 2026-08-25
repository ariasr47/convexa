use super::{ResourceSampler, ResourceSnapshot, SampleError};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Mutex, OnceLock};

struct PersistentSampler {
    _process: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}
impl PersistentSampler {
    fn start() -> Result<Self, SampleError> {
        let script = "$input | ForEach-Object { $p=Get-Process -Id ([int]$_) -ErrorAction Stop; \"$_`t$($p.WorkingSet64)`t$($p.Handles)\" }";
        let mut process = Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| SampleError::Unavailable(e.to_string()))?;
        let stdin = process
            .stdin
            .take()
            .ok_or_else(|| SampleError::Unavailable("sampler stdin unavailable".into()))?;
        let stdout = process
            .stdout
            .take()
            .ok_or_else(|| SampleError::Unavailable("sampler stdout unavailable".into()))?;
        Ok(Self {
            _process: process,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }
    fn sample(&mut self, pid: u32) -> Result<ResourceSnapshot, SampleError> {
        writeln!(self.stdin, "{pid}").map_err(|e| SampleError::Unavailable(e.to_string()))?;
        self.stdin
            .flush()
            .map_err(|e| SampleError::Unavailable(e.to_string()))?;
        let mut line = String::new();
        self.stdout
            .read_line(&mut line)
            .map_err(|e| SampleError::Unavailable(e.to_string()))?;
        let fields: Vec<_> = line.trim().split('\t').map(str::trim).collect();
        if fields.len() != 3 || fields[0] != pid.to_string() {
            return Err(SampleError::Invalid);
        }
        Ok(ResourceSnapshot {
            rss_bytes: fields[1].parse().map_err(|_| SampleError::Invalid)?,
            handles_or_fds: fields[2].parse().map_err(|_| SampleError::Invalid)?,
            semantic: "windows_working_set_bytes_handles_persistent_sampler",
        })
    }
}
static SAMPLER: OnceLock<Mutex<Result<PersistentSampler, String>>> = OnceLock::new();
pub struct WindowsSampler;
impl ResourceSampler for WindowsSampler {
    fn sample_pid(pid: u32) -> Result<ResourceSnapshot, SampleError> {
        let sampler = SAMPLER
            .get_or_init(|| Mutex::new(PersistentSampler::start().map_err(|e| e.to_string())));
        let mut guard = sampler
            .lock()
            .map_err(|_| SampleError::Unavailable("sampler mutex poisoned".into()))?;
        match &mut *guard {
            Ok(process) => process.sample(pid),
            Err(error) => Err(SampleError::Unavailable(error.clone())),
        }
    }
}
