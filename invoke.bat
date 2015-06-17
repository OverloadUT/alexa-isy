@echo off
echo Invoking...
aws lambda invoke --invocation-type RequestResponse --function-name alexaISY --region us-east-1 --log-type Tail --payload file://event.json outputfile.json
echo Complete. Output:
type outputfile.json
