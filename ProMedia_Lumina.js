/**
 * SignalRGB plugin — Klipsch ProMedia Lumina (HID)
 * Protocol matches KlipschControl (A5 5A 70 framing + checksum).
 */

export function Name() {
	return "ProMedia Lumina";
}

export function Publisher() {
	return "Klipsch Group, Inc";
}

export function VendorId() {
	return 0x18b5;
}

export function ProductId() {
	return 0x0070;
}

export function Type() {
	return "hid";
}

export function Documentation() {
	return "troubleshooting/klipsch";
}

export function Size() {
	return [7, 2];
}

export function DefaultPosition() {
	return [120, 120];
}

export function DefaultScale() {
	return 28.0;
}

/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
SystemSuspending:readonly
*/

export function ControllableParameters() {
	return [
		{
			property: "shutdownColor",
			group: "lighting",
			label: "Shutdown Color",
			min: "0",
			max: "360",
			type: "color",
			default: "#009bde",
		},
		{
			property: "LightingMode",
			group: "lighting",
			label: "Lighting Mode",
			type: "combobox",
			values: ["Canvas", "Forced"],
			default: "Canvas",
		},
		{
			property: "forcedColor",
			group: "lighting",
			label: "Forced Color",
			min: "0",
			max: "360",
			type: "color",
			default: "#009bde",
		},
	];
}

export function ConflictingProcesses() {
	return [
		"KlipschControl.exe",
		"klipschcontrol.exe"
	];
}

/**
 * Logical LED 1–12: left speaker (1–6) top-left row then bottom row,
 * then right speaker (7–12) same layout. Canvas column 3 is a visual gap.
 */
const vLedNames = [
	"Left Top 1",
	"Left Top 2",
	"Left Top 3",
	"Left Bottom 1",
	"Left Bottom 2",
	"Left Bottom 3",
	"Right Top 1",
	"Right Top 2",
	"Right Top 3",
	"Right Bottom 1",
	"Right Bottom 2",
	"Right Bottom 3",
];

/** Positions [x,y] matching LED order above */
const vLedPositions = [
	[0, 0],
	[1, 0],
	[2, 0],
	[0, 1],
	[1, 1],
	[2, 1],
	[4, 0],
	[5, 0],
	[6, 0],
	[4, 1],
	[5, 1],
	[6, 1],
];

export function LedNames() {
	return vLedNames;
}

export function LedPositions() {
	return vLedPositions;
}

// --- Protocol (see KlipschControl Models/HidCommand.cs, Data/Commands.cs) ---

const CMD_LIGHT_MODE = 0x0b;
const CMD_CUSTOM_LIGHTING = 0x11;
const CMD_POWER_STATE = 0x16;

/** Wire byte for LightMode.ScreenReact — required for CustomLightingMode streaming */
const LIGHT_MODE_SCREEN_REACT = 0x07;
const LIGHT_MODE_OFF = 0x06;

const LEN_BYTE_DEFAULT = 0x08;
const LEN_BYTE_CUSTOM_LIGHTING = 0x2b;
const LEFT_SPEAKER = "Left Speaker";
const RIGHT_SPEAKER = "Right Speaker";
const DEFAULT_OUTPUT_REPORT_LEN = 65;

function calculateChecksum(buffer, length) {
	let sum = 0;
	for (let i = 0; i < length; i++) {
		sum += buffer[i];
	}
	return (256 - (sum & 0xff)) & 0xff;
}

/**
 * Build framed payload (no report ID): A5 5A 70 | cmd | len | 00 | data... | checksum
 */
function buildFrame(commandId, lengthByte1, dataBytes) {
	const out = [];
	out.push(0xa5, 0x5a, 0x70, commandId, lengthByte1, 0x00);
	for (let i = 0; i < dataBytes.length; i++) {
		out.push(dataBytes[i]);
	}
	const chk = calculateChecksum(out, out.length);
	out.push(chk);
	return out;
}

function writeOutputReport(framedPayload) {
	const packet = [0x00];
	for (let i = 0; i < framedPayload.length; i++) {
		packet.push(framedPayload[i]);
	}
	const padded = new Array(DEFAULT_OUTPUT_REPORT_LEN).fill(0x00);
	for (let i = 0; i < packet.length && i < padded.length; i++) {
		padded[i] = packet[i];
	}

	try {
		device.write(padded, padded.length);
		return;
	} catch (errorWritePadded) {
		// try next transport
	}

	try {
		device.write(packet, packet.length);
		return;
	} catch (errorWriteRaw) {
		// try next transport
	}

	try {
		device.send_report(padded, padded.length);
		return;
	} catch (errorSendPadded) {
		// try final transport
	}

	device.send_report(packet, packet.length);
}

function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) {
		return [0, 0, 0];
	}
	return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

function createSpeakerComponents() {
	device.createSubdevice(LEFT_SPEAKER);
	device.setSubdeviceName(LEFT_SPEAKER, "ProMedia Lumina - Left Speaker");
	device.setSubdeviceImageUrl(LEFT_SPEAKER, "https://raw.githubusercontent.com/Klipsch-Group/ProMedia-Lumina-SignalRGB/refs/heads/main/images/promedia_lumina_left.png");
	device.setSubdeviceSize(LEFT_SPEAKER, 3, 2);

	device.createSubdevice(RIGHT_SPEAKER);
	device.setSubdeviceName(RIGHT_SPEAKER, "ProMedia Lumina - Right Speaker");
	device.setSubdeviceImageUrl(RIGHT_SPEAKER, "https://raw.githubusercontent.com/Klipsch-Group/ProMedia-Lumina-SignalRGB/refs/heads/main/images/promedia_lumina_right.png");
	device.setSubdeviceSize(RIGHT_SPEAKER, 3, 2);
}

function getComponentColor(componentName, x, y) {
	try {
		const c = device.subdeviceColor(componentName, x, y);
		if (Array.isArray(c) && c.length >= 3) {
			return c;
		}
	} catch (error) {
		// Fall back to main canvas if subdevice color isn't available.
	}
	return null;
}

/**
 * Read RGB for canvas index i (0..11). Same order as vLedPositions.
 */
function rgbForLedIndex(i, shutdownMode, shutdownHex) {
	const x = vLedPositions[i][0];
	const y = vLedPositions[i][1];
	if (shutdownMode) {
		return hexToRgb(shutdownHex);
	}
	if (LightingMode === "Forced") {
		return hexToRgb(forcedColor);
	}
	if (i < 6) {
		const leftColor = getComponentColor(LEFT_SPEAKER, x, y);
		if (leftColor) {
			return leftColor;
		}
	} else {
		const rightColor = getComponentColor(RIGHT_SPEAKER, x - 4, y);
		if (rightColor) {
			return rightColor;
		}
	}
	return device.color(x, y); // fallback if components aren't placed
}

/**
 * Device wire order matches WriteCustomColorsWithQualitySubZones in MainWindowViewModel:
 * L1–L4, then L6,L5 (swap), then R1–R4, then R6,R5 (swap).
 */
function buildCustomLightingPayload(shutdownMode, shutdownHex) {
	const logical = [];
	for (let i = 0; i < 12; i++) {
		logical.push(rgbForLedIndex(i, shutdownMode, shutdownHex));
	}

	const wireOrderIdx = [0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 11, 10];
	const payload = [];
	for (let w = 0; w < wireOrderIdx.length; w++) {
		const rgb = logical[wireOrderIdx[w]];
		payload.push(rgb[0], rgb[1], rgb[2]);
	}
	return payload;
}

function sendScreenReactColors(shutdownMode, shutdownHex) {
	const data = buildCustomLightingPayload(shutdownMode, shutdownHex);
	const frame = buildFrame(CMD_CUSTOM_LIGHTING, LEN_BYTE_CUSTOM_LIGHTING, data);
	writeOutputReport(frame);
}

function sendLightMode(modeByte) {
	const frame = buildFrame(CMD_LIGHT_MODE, LEN_BYTE_DEFAULT, [modeByte]);
	writeOutputReport(frame);
}

function sendPowerWake() {
	const frame = buildFrame(CMD_POWER_STATE, LEN_BYTE_DEFAULT, [0x01]);
	writeOutputReport(frame);
}

/** Raw wakeup seen in KlipschControl (report ID + magic prefix) */
function sendRawWakeup() {
	device.write([0x00, 0xa5, 0x5a, 0x70], 4);
}

export function Initialize() {
	createSpeakerComponents();
	sendPowerWake();
	device.pause(80);
	sendRawWakeup();
	device.pause(80);
	sendLightMode(LIGHT_MODE_SCREEN_REACT);
	device.pause(40);
}

export function Render() {
	sendPowerWake();
	device.pause(5);
	sendLightMode(LIGHT_MODE_SCREEN_REACT);
	sendScreenReactColors(false, shutdownColor);
}

export function Shutdown() {
	const suspending = typeof SystemSuspending !== "undefined" ? SystemSuspending : false;
	// Aggressive off sequence: wake, push black frame, switch mode off, repeat.
	sendPowerWake();
	device.pause(20);
	sendRawWakeup();
	device.pause(20);
	sendScreenReactColors(true, "#000000");
	device.pause(20);
	sendLightMode(LIGHT_MODE_OFF);
	device.pause(20);
	sendLightMode(LIGHT_MODE_OFF);
	device.pause(20);
	sendScreenReactColors(true, "#000000");
	device.pause(20);
}

/**
 * Pick the primary HID interface (KlipschControl enumerates collection report devices).
 * If the plugin does not attach, try relaxing this or match usage_page from Device Manager.
 */
export function Validate(endpoint) {
	return (
		endpoint.interface === 0x00 ||
		endpoint.usage_page === 0xff00 ||
		endpoint.usage_page === 0x0001
	);
}

export function ImageUrl() {
	return "https://klipsch.imgix.net/product-images/Klipsch-ProMedia_Lumina-Family-2000x2000.png";
}
