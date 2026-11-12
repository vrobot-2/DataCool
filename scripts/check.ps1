$root = Split-Path -Parent $PSScriptRoot
$checks = @(
  @{n="rack STEP";   p="assets\rack\rack.step"},
  @{n="rack preview";p="assets\rack\rack_preview.png"},
  @{n="exch frame";  p="assets\exchanger\exchanger_frame.step"},
  @{n="exch core";   p="assets\exchanger\exchanger_core.step"},
  @{n="exch ports";  p="assets\exchanger\exchanger_ports.step"},
  @{n="district";    p="assets\district\district.step"},
  @{n="scene.blend"; p="pipeline\scene.blend"},
  @{n="scene.glb";   p="app\public\models\scene.glb"},
  @{n="app build";   p="app\dist\index.html"},
  @{n="phase 0";     p="pipeline\renders\phase_0.png"},
  @{n="phase 3";     p="pipeline\renders\phase_3.png"}
)
$fail = 0
foreach ($c in $checks) {
  $f = Join-Path $root $c.p
  if (Test-Path $f) {
    $kb = [math]::Round((Get-Item $f).Length / 1KB, 0)
    Write-Host ("PASS  {0,-14} {1,8} KB  {2}" -f $c.n, $kb, $c.p)
  } else {
    $fail++
    Write-Host ("MISS  {0,-14} {1,12}  {2}" -f $c.n, "-", $c.p)
  }
}
Write-Host ""
Write-Host ("{0} / {1} present" -f ($checks.Count - $fail), $checks.Count)
exit $fail
