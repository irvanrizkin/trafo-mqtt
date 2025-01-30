import axios from "axios";
import * as mqtt from "mqtt";
import topicTableMap from "../config/topic-table-map";

export class MqttService {
    static mqttClient: mqtt.MqttClient;
    static dataBuffer: Record<number, Record<string, any>> = {}; // { epoch: { table: { column: value } } }
    static debounceTimer: NodeJS.Timeout | null = null;
    static UPLOAD_DELAY = 2000; // Delay before sending to API

    static topicMap = topicTableMap;

    static connect() {
        MqttService.mqttClient = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://broker.emqx.io', {
            clientId: 'mqttjs_' + Math.random().toString(16).substring(2, 8),
            reconnectPeriod: 5000,
            clean: true,
            username: process.env.MQTT_USERNAME || '',
            password: process.env.MQTT_PASSWORD || '',
        });

        MqttService.mqttClient.on('connect', () => {
            console.log('Connected to MQTT Broker');
        });

        // Subscribe to all topics
        for (let topic in MqttService.topicMap) {
            MqttService.mqttClient.subscribe(topic);
            console.log(`Subscribed to ${topic}`);
        }

        MqttService.mqttClient.on('message', (topic, message) => {
            MqttService.handleMessage(topic as keyof typeof MqttService.topicMap, message.toString());
        });
    }

    static handleMessage(topic: keyof typeof MqttService.topicMap, message: string) {
        const data = MqttService.topicMap[topic];
        if (!data) return;

        const { table, column } = data;
        const payload = message;
        const datetime = Math.floor(Date.now() / 1000);

        if (!datetime) {
            console.error(`Missing datetime in data: ${message}`);
            return;
        }

        // Initialize buffer for this datetime
        if (!MqttService.dataBuffer[datetime]) MqttService.dataBuffer[datetime] = {};
        if (!MqttService.dataBuffer[datetime][table]) MqttService.dataBuffer[datetime][table] = { datetime };

        // Store data in buffer
        MqttService.dataBuffer[datetime][table][column] = payload;

        // Schedule sending after delay
        MqttService.debounceSend();
    }

    static debounceSend() {
        if (MqttService.debounceTimer) clearTimeout(MqttService.debounceTimer);

        MqttService.debounceTimer = setTimeout(() => {
            const batchData = Object.entries(MqttService.dataBuffer).map(([datetime, tables]) => {
                return Object.entries(tables).map(function([table, data]) {
                    const { datetime, ...restData } = data;
                    return {
                        table,
                        data: {
                            ...restData,
                            trafo_id: 1, // Hardcoded trafo_id
                            topic_name: table
                        }
                    };
                });
            }).flat(); // Flatten to match required JSON format

            if (batchData.length === 0) return;

            // Send batched data via HTTP
            axios.post(process.env.BASE_URL || 'https://reqres.in/api/users', batchData)
            .then(response => {
                console.log(`Sent data:`, response.data);
            })
            .catch(error => {
                console.error(`Failed to send data:`, error);
            });

            // Clear buffer
            MqttService.dataBuffer = {};
        }, MqttService.UPLOAD_DELAY);
    }
}
