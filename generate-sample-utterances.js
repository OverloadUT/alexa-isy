var config = require('./houseconfig.js');

var intents = {
	AdjustDeviceIntent: [
        '{action} the {device}',
        'turn the {device} {action}'
    ]
};

Object.keys(intents).forEach(function(intent) {
    var intentarray = intents[intent];

    intentarray.forEach(function(intentstring){
        config.actions.forEach(function(action){
            config.devices.forEach(function(device){
                var output = intentstring.replace(/\{action\}/i, "{"+action.name+"|Action}");
                output = output.replace(/\{device\}/i, "{"+device.name+"|Device}");
                console.log(intent + " " + output);
            });
        });
    });
});