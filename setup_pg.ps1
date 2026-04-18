$ErrorActionPreference = "Stop"

if (-not (Test-Path "pgsql")) {
    Write-Host "Downloading PostgreSQL binaries (this may take a minute) using curl..."
    curl.exe -Lfo postgres.zip "https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64-binaries.zip"
    
    Write-Host "Extracting PostgreSQL using tar..."
    tar.exe -xf postgres.zip
    Remove-Item "postgres.zip" -Force
}

if (-not (Test-Path "pgsql\data")) {
    Write-Host "Initializing Database Cluster with UTF8 encoding..."
    Set-Content -Path "pw.txt" -Value "ia_password"
    .\pgsql\bin\initdb.exe -D .\pgsql\data -U ia_user --pwfile=pw.txt --auth=md5 -E UTF8
    Remove-Item "pw.txt" -Force
}

Write-Host "Starting PostgreSQL Server..."
Start-Process -FilePath ".\pgsql\bin\pg_ctl.exe" -ArgumentList "-D .\pgsql\data -l logfile start" -WindowStyle Hidden
Start-Sleep -Seconds 5

Write-Host "Creating ia_db database (if not exists)..."
$env:PGPASSWORD = "ia_password"
$dbExists = .\pgsql\bin\psql.exe -U ia_user -p 5432 -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname = 'ia_db'"
if ($dbExists -notmatch "1") {
    .\pgsql\bin\createdb.exe -U ia_user -p 5432 ia_db
    Write-Host "Database ia_db created."
} else {
    Write-Host "Database ia_db already exists."
}
$env:PGPASSWORD = $null

Write-Host "PostgreSQL setup complete and running."
