function deepCopy(object) {
	if (typeof object !== "object") return object;

	const newObject = Array.isArray(object) ? [] : {};

	for (var key in object) {
		newObject[key] = deepCopy(object[key]);
	}

	return newObject;
}

function toHHMMSS(sec_num) {
	if (typeof sec_num !== "number") return "Inf";

	var hours = Math.floor(sec_num / 3600);
	var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	var seconds = Math.round(sec_num - (hours * 3600) - (minutes * 60));

	if (seconds < 10) seconds = "0" + seconds;
	if (minutes < 10) minutes = "0" + minutes;
	if (hours < 10) hours = "0" + hours;

	if (hours >= 24) {
		var days = Math.floor(hours / 24);
		return days + "d " + (hours % 24) + 'h';
	}

	return hours + ':' + minutes + ':' + seconds;
}

function prettyNumber(x) {
	if (typeof x === "undefined") return 0;

	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function sleep(milliseconds) {
	var start = new Date().getTime();
	for (var i = 0; i < 1e7; i++) {
		if ((new Date().getTime() - start) > milliseconds) break;
	}
}

export {deepCopy, sleep, prettyNumber, toHHMMSS};

