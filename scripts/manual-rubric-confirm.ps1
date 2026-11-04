param([Parameter(Mandatory=$true)][string]$ContextPath)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$taskContext = Get-Content -LiteralPath $ContextPath -Raw | ConvertFrom-Json
$taskMarker = Get-Content -LiteralPath (Join-Path $taskContext.root '.test-owner.json') -Raw | ConvertFrom-Json
if ($taskMarker.owner -ne $taskContext.owner) { throw '测试环境所有权不匹配。' }
if (Test-Path -LiteralPath (Join-Path $taskContext.root 'launcher-state.json')) {
  [System.Windows.Forms.MessageBox]::Show('请先正常关闭隔离 Desktop，再确认模型版本与新预算。原生模型配置会保留。','DSH 手动测试') | Out-Null
  exit 1
}
$taskExisting = Get-Content -LiteralPath (Join-Path $taskContext.root 'authorization.json') -Raw | ConvertFrom-Json
$taskForm = New-Object System.Windows.Forms.Form
$taskForm.Text = 'DSH 隔离测试：由你确认模型与预算'
$taskForm.Size = New-Object System.Drawing.Size(760,740)
$taskForm.StartPosition = 'CenterScreen'
$taskForm.AutoScroll = $true
$taskFields = @{}
function Add-TaskText([string]$Key,[string]$Label,[string]$Value,[int]$Y) {
  $taskLabel = New-Object System.Windows.Forms.Label
  $taskLabel.Text = $Label; $taskLabel.Location = New-Object System.Drawing.Point(20,$Y); $taskLabel.Size = New-Object System.Drawing.Size(320,26)
  $taskInput = New-Object System.Windows.Forms.TextBox
  $taskInput.Text = $Value; $taskInput.Location = New-Object System.Drawing.Point(345,$Y); $taskInput.Size = New-Object System.Drawing.Size(370,26)
  $taskForm.Controls.Add($taskLabel); $taskForm.Controls.Add($taskInput); $taskFields[$Key] = $taskInput
}
$taskIntro = New-Object System.Windows.Forms.Label
$taskIntro.Text = '先在官方 Desktop 的原生模型设置中配置路由。这里只填写 ID、核验说明与预算，不填写 API Key。保存后仍须你在 Desktop 中手动发起科研。'
$taskIntro.Location = New-Object System.Drawing.Point(20,15); $taskIntro.Size = New-Object System.Drawing.Size(695,50); $taskForm.Controls.Add($taskIntro)
Add-TaskText 'provider' 'Provider ID（不是显示名称）' $taskExisting.provider 80
Add-TaskText 'model' '实际 Model ID' $taskExisting.model 115
Add-TaskText 'revision' '已核验的不可变版本；未知请留空' $taskExisting.modelRevision 150
Add-TaskText 'price' '价格核验来源/说明；未知请写“未知”' '未知' 185
Add-TaskText 'fee' '费用预算说明（本地不执行金额硬限额）' '费用未知；如需金额硬限额，请在服务商后台设置' 220
Add-TaskText 'calls' '累计原生模型 dispatch 上限' ([string]$taskExisting.budget.maxModelCalls) 270
Add-TaskText 'chars' '累计序列化提示字符上限' ([string]$taskExisting.budget.maxPromptCharacters) 305
Add-TaskText 'output' '每次输出 Token 上限（最多4096）' ([string]$taskExisting.budget.maxOutputTokens) 340
Add-TaskText 'seconds' '总准入时间上限（秒，最多300）' ([string]([int]$taskExisting.budget.maxMilliseconds/1000)) 375
$taskNote = New-Object System.Windows.Forms.Label
$taskNote.Text = 'Rubric 单阶段60秒、网络30次、PDF30页、OCR关闭、Shadow。总时间限制后续请求准入；正在执行的请求请使用 Desktop 停止按钮。未知版本不允许跨重启复用模型输出。费用始终标为未知；本地金额限额无法可靠保证。'
$taskNote.Location = New-Object System.Drawing.Point(20,420); $taskNote.Size = New-Object System.Drawing.Size(695,75); $taskForm.Controls.Add($taskNote)
$taskCheck = New-Object System.Windows.Forms.CheckBox
$taskCheck.Text = '我已核对模型/版本状态、价格状态及上述新预算，并由我亲自在 Desktop 发起调用。'
$taskCheck.Location = New-Object System.Drawing.Point(20,510); $taskCheck.Size = New-Object System.Drawing.Size(695,45); $taskForm.Controls.Add($taskCheck)
$taskSave = New-Object System.Windows.Forms.Button
$taskSave.Text = '确认条件并保存（不会发起调用）'; $taskSave.Location = New-Object System.Drawing.Point(350,580); $taskSave.Size = New-Object System.Drawing.Size(365,40); $taskSave.Enabled = $false; $taskForm.Controls.Add($taskSave)
$taskCheck.Add_CheckedChanged({ $taskSave.Enabled = $taskCheck.Checked })
$taskSave.Add_Click({
  try {
    $taskBudget = @{ maxModelCalls=[int]$taskFields.calls.Text; maxPromptCharacters=[int]$taskFields.chars.Text; maxOutputTokens=[int]$taskFields.output.Text; maxMilliseconds=([int]$taskFields.seconds.Text*1000) }
    if (-not $taskFields.provider.Text.Trim() -or -not $taskFields.model.Text.Trim() -or -not $taskFields.price.Text.Trim() -or $taskBudget.maxModelCalls -lt 1 -or $taskBudget.maxModelCalls -gt 500 -or $taskBudget.maxPromptCharacters -lt 1 -or $taskBudget.maxPromptCharacters -gt 10000000 -or $taskBudget.maxOutputTokens -lt 1 -or $taskBudget.maxOutputTokens -gt 4096 -or $taskBudget.maxMilliseconds -lt 1000 -or $taskBudget.maxMilliseconds -gt 300000) { throw '请填写路由、价格状态及有效预算。' }
    $taskRevision = $taskFields.revision.Text.Trim()
    $taskDraft = @{confirmed=$true; provider=$taskFields.provider.Text.Trim(); model=$taskFields.model.Text.Trim(); modelRevision=$taskRevision; versionStatus=$(if($taskRevision){'verified'}else{'unknown'}); pricingStatus='user-acknowledged'; pricingNote=$taskFields.price.Text; feeBudgetNote=$taskFields.fee.Text; versionAcknowledged=$true; pricingAcknowledged=$true; budgetAcknowledged=$true; budget=$taskBudget}
    $taskJson = $taskDraft | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText((Join-Path $taskContext.root 'authorization-draft.json'),$taskJson,(New-Object System.Text.UTF8Encoding($false)))
    $taskProject = (Get-Content -LiteralPath (Join-Path (Split-Path -Parent $ContextPath) 'launcher-paths.json') -Raw | ConvertFrom-Json)
    $taskOutput = & $taskProject.node $taskProject.runner authorize $ContextPath 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($taskOutput -join "`n") }
    [System.Windows.Forms.MessageBox]::Show('确认已保存。现在运行“启动隔离Desktop”，然后在原生界面手动发起科研。','DSH 手动测试') | Out-Null
    $taskForm.Close()
  } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'未保存') | Out-Null }
})
[void]$taskForm.ShowDialog()
