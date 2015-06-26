var devices = require('./devices.json');
var actions = require('./actions.json');

var intents = {
	AdjustDeviceIntent: [
        '{action} the {device}',
        'turn the {device} {action}'
    ]
};

Object.keys(intents).forEach(function(intent) {
    var intentarray = intents[intent];

    intentarray.forEach(function(intentstring){
        actions.forEach(function(action){
            devices.forEach(function(device){
                var output = intentstring.replace(/\{action\}/i, "{"+action.name+"|Action}");
                output = output.replace(/\{device\}/i, "{"+device.name+"|Device}");
                console.log(intent + " " + output);
            });
        });
    });
});