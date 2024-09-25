import * as mqtt from "mqtt";

export class MqttService {
	static mqttClient: mqtt.MqttClient;
	static connect() {
		MqttService.mqttClient = mqtt.connect(
			process.env.MQTT_BROKER || 'mqtt://broker.emqx.io', {
				clientId: 'mqttjs_' + Math.random().toString(16).substring(2, 8),
				reconnectPeriod: 5000,
				clean: true,
				username: process.env.MQTT_USERNAME || '',
				password: process.env.MQTT_PASSWORD || '',
			}
		);

		MqttService.mqttClient.on('connect', () => {
			console.log('Connected to MQTT Broker');
		});

		for (let i = 1; i <= 18; i++) {
			MqttService.mqttClient.subscribe(`data${i}`);
			console.log(`Subscribed to data${i}`);
		}

		MqttService.mqttClient.on('message', (topic, message) => {
			console.log(`Received message from ${topic}: ${message.toString()}`);
		});
	}
}
