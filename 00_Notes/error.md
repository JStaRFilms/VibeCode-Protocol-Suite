   npm version patch
   npm publish 
 
  npm uninstall -g takomi
   npm install -g takomi@latest

   Remove-Item "$env:USERPROFILE\.pi" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item "$env:USERPROFILE\.takomi\pi-manifest.json" -Force -ErrorAction SilentlyContinue

   takomi install pi
   takomi doctor
   takomi --version
   takomi

npm install -g

powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1 