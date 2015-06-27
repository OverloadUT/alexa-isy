var devices = require('./devices.json').devices;
var actions = require('./actions.json').actions;
var scenes = require('./scenes.json').scenes;

var intents = {
	AdjustDeviceIntent: [
        '{action} the {device}',
        'turn the {device} {action}'
    ],
	ActivateSceneIntent: [
        'activate {scene}',
        "it's {scene} time",
        "prepare for {scene}",
        "it's time for {scene}"
    ]
};

Object.keys(intents).forEach(function(intent) {
    var intentarray = intents[intent];

    if(intent === 'AdjustDeviceIntent') {
        intentarray.forEach(function(intentstring){
            actions.forEach(function(action){
                devices.forEach(function(device){
                    var output = intentstring;
                    output = output.replace(/\{action\}/i, "{"+action.name+"|Action}");
                    output = output.replace(/\{device\}/i, "{"+device.name+"|Device}");
                    console.log(intent + " " + output);
                });
            });
        });
    } else if (intent === 'ActivateSceneIntent') {
        intentarray.forEach(function(intentstring){
            scenes.forEach(function(scene){
                var output = intentstring;
                output = output.replace(/\{scene\}/i, "{" + scene.name + "|Scene}");
                console.log(intent + " " + output);
            });
        });
    }
});