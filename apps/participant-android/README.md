# Travel Bingo Android

원스토어 제출과 실제 Android 기기 테스트를 위한 Capacitor 컨테이너입니다.

앱 화면은 배포된 참가자 웹을 불러오므로 일반 UI와 기능 변경은 웹 배포 후 앱을 다시 열면 반영됩니다. Android 권한, 앱 아이콘, 시작 화면, 네이티브 플러그인 또는 패키지 설정을 바꾼 경우에는 새 APK가 필요합니다.

## 테스트 APK

루트에서 다음 명령을 실행합니다.

```powershell
pnpm --filter @travel-bingo/participant-android apk:debug
```

생성 파일:

```text
apps/participant-android/android/app/build/outputs/apk/debug/app-debug.apk
```

USB 디버깅이 허용된 기기가 연결되어 있다면 다음 명령으로 바로 설치할 수 있습니다.

```powershell
pnpm --filter @travel-bingo/participant-android apk:install
```

원스토어 제출본은 별도의 업로드 키로 서명한 release APK를 사용합니다. 테스트용 debug APK는 제출하지 않습니다.
