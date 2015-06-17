@echo off
rmdir dist\install /S /Q
mkdir dist\install
call npm install --prefix dist\install .
del dist\alexa-isy.zip
7z a dist\alexa-isy.zip .\dist\install\node_modules\alexa-isy\*
echo Function zipped. Updating...
aws lambda update-function-code --zip-file fileb://dist\alexa-isy.zip --function-name alexaISY
