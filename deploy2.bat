@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set GCLOUD=C:\Google\CloudSDK\google-cloud-sdk\bin\gcloud.cmd
set PROJECT=face-scan-505816
set LOGFILE=D:\Demo_Projects\Face_Scan\deploy.log

echo Starting deploy at %DATE% %TIME% > "%LOGFILE%"
cd /d D:\Demo_Projects\Face_Scan >> "%LOGFILE%" 2>&1

echo [1] Setting project... >> "%LOGFILE%"
%GCLOUD% config set project %PROJECT% >> "%LOGFILE%" 2>&1
echo [1] Done. ErrorLevel=%ERRORLEVEL% >> "%LOGFILE%"

echo [2] Deploying... >> "%LOGFILE%"
%GCLOUD% run deploy face-scan-api --source . --region asia-southeast3 --platform managed --allow-unauthenticated --memory 4Gi --cpu 2 --port 8000 --min-instances 0 --max-instances 10 --set-env-vars "SUPABASE_URL=https://htgmakeuytiknkumxgii.supabase.co,SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0Z21ha2V1eXRpa25rdW14Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjIxMTEwNCwiZXhwIjoyMTAxNzg3MTA0fQ.GmN3JhCSTRDkruAkxKyV5lSYus7uxdBsN8UzchBaYsI,SUPABASE_ANON_KEY=sb_publishable_G_JyjQD6qiNvOb73Qzmy1Q_fw5JGuhC,STORAGE_BUCKET=photos,R2_WORKER_URL=https://cs.face-scan-r2.workers.dev,R2_THUMB_API_KEY=N3wrLp65xEHeEc1dywCsV1MTkLnFvmA92GnV1ku2JCU=,FACE_PACK=buffalo_l,CORS_ORIGINS_CSV=*,INDEX_API_KEY=" --project %PROJECT% >> "%LOGFILE%" 2>&1
echo [2] Done. ErrorLevel=%ERRORLEVEL% >> "%LOGFILE%"

echo ================================= >> "%LOGFILE%"
echo FINISHED at %DATE% %TIME% >> "%LOGFILE%"
echo Read deploy.log for details >> "%LOGFILE%"
