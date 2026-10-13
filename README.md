# VoiceDesk

Gemini를 이용한 음성 전사, 화자 구분, 한국어 번역 및 CSV 저장용 Windows Python 프로그램입니다.

## 집 컴퓨터에서 실행

Python 3를 설치한 뒤 이 저장소를 내려받고, 프로젝트 폴더의 PowerShell에서 실행합니다.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:GEMINI_API_KEY = "본인의 Gemini API 키"
.\.venv\Scripts\python.exe VoiceDesk.py
```

키는 GitHub에 올리지 않습니다. 환경 변수는 위 명령을 실행한 PowerShell 창에서만 유지됩니다. 음성 파일은 Gemini 서비스로 전송됩니다. API 이용 비용과 한도는 본인의 계정 설정에 따릅니다.

## 회사와 집에서 이어서 작업

처음에는 각 컴퓨터에서 이 저장소를 복제합니다.

```powershell
git clone https://github.com/juhyun467/VoiceDesk.git
cd VoiceDesk
```

작업을 시작할 때는 `git pull`, 작업을 마칠 때는 다음 명령으로 저장합니다.

```powershell
git add VoiceDesk.py README.md requirements.txt .gitignore
git commit -m "작업 내용 설명"
git push
```

두 컴퓨터 모두 같은 저장소를 복제한 폴더에서 작업합니다. GitHub는 자동 저장이 아니므로 작업 후 올리고, 다른 컴퓨터에서 시작하기 전에 최신 내용을 받습니다. 각 컴퓨터의 작업을 올린 뒤 컴퓨터를 바꿉니다.

## 저장 범위

기존 outputs 폴더의 VoiceDesk.py를 기준으로 저장했습니다. 코드에 직접 들어 있던 API 키를 환경 변수로 분리했습니다. 기존 실행 파일과 원본 안내 문서는 이 Python 코드와 기능 설명이 달라 포함하지 않았습니다. 실행 파일, 음성 파일, 전사 결과 및 접속 키는 저장소에 포함하지 않습니다.
