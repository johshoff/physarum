'use strict';

const settings = {
	sensor_distance:  2,
	sensor_angle:     40/180*Math.PI, // radians
	turning_speed:    40/180*Math.PI, // radians
	speed:            1,
	decay_factor:     0.95,
	deposit_amount:   0.6,
	num_agents:       5000,
	start_in_circle:  false, // otherwise start randomly
	highlight_agents: false,
	random_turning:   false, // randomly turn within the limits of turning_speed
	wrap_around:      true,
	show_debug:       false,
};
const settings_to_text = {
	sensor_angle: rad_to_deg,
	turning_speed: rad_to_deg,
	num_agents: v => ''+v,
};

// use a Gaussian kernel for diffusion
const weight = [
	1/16, 1/8, 1/16,
	 1/8, 1/4,  1/8,
	1/16, 1/8, 1/16,
];

let counts = [0,0,0,0];
let regenerate_next = true;

const default_settings = {};
for (const [key, value] of Object.entries(settings)) {
	default_settings[key] = value;
}

// convert radians to degrees
function rad_to_deg(value) {
	return Math.round(value * 180 / Math.PI);
}

// Update the state in place
function sim_step(agents, trail, width, height) {
	function index(x, y) {
		return x + y * width;
	}

	function step_sense_and_rotate() {
		for (let agent of agents) {
			function sense_relative_angle(theta) {
				return trail[index(
					Math.round(agent.x + Math.cos(agent.heading + theta) * settings.sensor_distance),
					Math.round(agent.y + Math.sin(agent.heading + theta) * settings.sensor_distance)
				)];
			}

			const sense_left   = sense_relative_angle(settings.sensor_angle);
			const sense_middle = sense_relative_angle(0);
			const sense_right  = sense_relative_angle(-settings.sensor_angle);

			const modified_turning = (settings.random_turning ? (Math.random() * 0.5 + 0.5) : 1) * settings.turning_speed;
			let option = -1;
			if (sense_middle > sense_left && sense_middle > sense_right) {
				// no change
				option = 0;
			} else if (sense_left > sense_right) {
				option = 1;
				agent.heading += modified_turning;
			} else if (sense_right > sense_left) {
				option = 2;
				agent.heading -= modified_turning;
			} else {
				option = 3;
				agent.heading += Math.round(Math.random() * 2 - 1) * settings.turning_speed;
			}
			counts[option] += 1
			agent.last_option = option;
		}
	}

	function step_move() {
		for (let agent of agents) {
			agent.x += settings.speed * Math.cos(agent.heading);
			agent.y += settings.speed * Math.sin(agent.heading);
			if (settings.wrap_around) {
				agent.x = (agent.x + width) % width;
				agent.y = (agent.y + height) % height;
			}
		}
	}

	function step_deposit() {
		for (let agent of agents) {
			const x = Math.round(agent.x);
			const y = Math.round(agent.y);
			if (x <= 0 || y <= 0 || x >= width-1 || y >= height-1)
				continue;
			trail[index(x, y)] += settings.deposit_amount;
		}
	}

	function step_diffuse_and_decay() {
		let old_trail = Float32Array.from(trail);
		for (let y=1; y<height-1; ++y) {
			for (let x=1; x<width-1; ++x) {
				const diffused_value = (
					old_trail[index(x-1, y-1)] * weight[0] +
					old_trail[index(x  , y-1)] * weight[1] +
					old_trail[index(x+1, y-1)] * weight[2] +
					old_trail[index(x-1, y  )] * weight[3] +
					old_trail[index(x  , y  )] * weight[4] +
					old_trail[index(x+1, y  )] * weight[5] +
					old_trail[index(x-1, y+1)] * weight[6] +
					old_trail[index(x  , y+1)] * weight[7] +
					old_trail[index(x+1, y+1)] * weight[8]
				);

				trail[index(x, y)] = Math.min(1.0, diffused_value * settings.decay_factor);
			}
		}
	}

	// Run steps shown in
	// https://payload.cargocollective.com/1/18/598881/13800048/diagram_670.jpg
	// Some steps are combined for speed and compactness
	step_sense_and_rotate();
	step_move();
	step_deposit();
	step_diffuse_and_decay();

	return trail;
}

function render(trail, canvas, agents) {
	const width = canvas.width;
	const height = canvas.height;
	const ctx = canvas.getContext('2d');
	const trail_image = ctx.getImageData(0, 0, width, height);

	const max_brightness = settings.highlight_agents ? 50 : 255;
	let i = 0;
	for (let y=0; y<height; ++y) {
		for (let x=0; x<width; ++x) {
			const value = trail[i];
			const brightness = Math.floor(value * max_brightness);
			trail_image.data[i*4+0] = brightness;
			trail_image.data[i*4+1] = brightness;
			trail_image.data[i*4+2] = brightness;
			trail_image.data[i*4+3] = 255;
			i++;
		}
	}
	if (settings.highlight_agents) {
		for (let agent of agents) {
			let color = [0,0,0];
			switch (agent.last_option) {
				case 0: color = [150, 50, 50]; break; // straight
				case 1: color = [ 50,150, 50]; break; // right
				case 2: color = [ 50, 50,150]; break; // left
				case 3: color = [255,255,255]; break; // indecisive
			}
			trail_image.data[(Math.floor(agent.x)+Math.floor(agent.y)*width)*4+0] = color[0];
			trail_image.data[(Math.floor(agent.x)+Math.floor(agent.y)*width)*4+1] = color[1];
			trail_image.data[(Math.floor(agent.x)+Math.floor(agent.y)*width)*4+2] = color[2];
		}
	}
	ctx.putImageData(trail_image, 0, 0);
}

function update_settings_text() {
	for (let name in settings) {
		let node = document.getElementById('text_'+name);
		if (!node) continue;
		let converter = settings_to_text[name];
		let value = settings[name];
		let text = converter ? converter(value) : value;
		if (typeof text == 'number') {
			text = text.toFixed(2);
		}
		node.innerText = text;
	}
}

// get settings from query string
function settings_from_query_string() {
	for (const [name, value] of (new URL(document.location)).searchParams) {
		if (name in settings) {
			if (typeof(settings[name]) == 'number') {
				settings[name] = parseFloat(value);
			} else {
				settings[name] = value == 'true';
			}
		}
	}
}
// update query string with non-default settings
function settings_to_query_string() {
	const params = (new URL(document.location)).searchParams;
	const before = params.toString();
	for (const [key, value] of Object.entries(settings)) {
		if (value != default_settings[key]) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
	}

	const url = new URL(document.location);
	if (params.toString() !== before) {
		url.search = '?'+params.toString();
		window.history.replaceState({},'',url);
	}
}
// store settings from settings object to DOM
function settings_to_dom() {
	for (let name in settings) {
		let node = document.getElementById(name);
		if (typeof(settings[name]) == 'number') {
			node.value = settings[name];
		} else {
			node.checked = settings[name];
		}
	}
	update_settings_text();
}
// load settings from DOM to settings object
function settings_from_dom() {
	for (let name in settings) {
		let node = document.getElementById(name);
		if (typeof(settings[name]) == 'number') {
			settings[name] = parseFloat(node.value);
		} else {
			settings[name] = node.checked;
		}
	}
	update_settings_text();
}
function reset_settings() {
	for (name in settings) {
		settings[name] = default_settings[name];
	}
	settings_to_dom();
}
function update_reset_button_enabled() {
	let any_non_default = false;
	for (let name in settings) {
		if (settings[name] != default_settings[name]) {
			any_non_default = true;
			break;
		}
	}

	document.getElementById('reset_button').disabled = !any_non_default;
}

onload = function() {
	settings_from_query_string();
	settings_to_dom();
	const canvas = document.getElementById('simcanvas');
	const width = canvas.width;
	const height = canvas.height;

	const agents = [];
	function regenerate() {
		agents.splice(0,agents.length); // empty list

		if (settings.start_in_circle) {
			const radius = Math.min(width, height) * 0.2;
			for (let i=0; i<settings.num_agents; ++i) {
				const t = 2 * Math.PI*i/settings.num_agents;
				agents.push({
					x: Math.cos(t) * radius + width / 2,
					y: Math.sin(t) * radius + height / 2,
					heading: t - Math.PI / 2,
				});
			}
		} else {
			for (let i=0; i<settings.num_agents; ++i) {
				agents.push({
					x: Math.random() * width,
					y: Math.random() * height,
					heading: Math.random() * 2 * Math.PI, // radians
				});
			}
		}
		regenerate_next = false;
	}

	let trail = new Float32Array(width * height);

	function next_frame() {
		settings_from_dom();
		settings_to_query_string();
		update_reset_button_enabled();
		if (regenerate_next) {
			regenerate();
		}
		trail = sim_step(agents, trail, width, height);
		render(trail, canvas, agents);
		window.requestAnimationFrame(next_frame);

		document.getElementById('debug').style.display = settings.show_debug ? 'block' : 'none';
		if (settings.show_debug) {
			let sum = 0;
			for (let c of counts) {
				sum += c;
			}
			stats.innerText = 'Straight, right, left, random: ' +
				counts.map(c => Math.round(c/sum*100)+'%').join(', ');
		}
	}

	next_frame();

	skip = function(num_frames) {
		for (var i=0; i<num_frames; ++i) {
			trail = sim_step(agents, trail, width, height);
		}
	}
}

// functions that will be overridden in onload
var skip = function() {}
