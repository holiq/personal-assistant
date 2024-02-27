import {
	GoogleGenerativeAI,
	HarmBlockThreshold,
	HarmCategory,
	type InputContent,
} from "@google/generative-ai";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import GeminiMessageHandlerAction from "../../../foundation/actions/GeminiMessageHandlerAction.js";
import DB from "../../../services/database.js";
import { Queue, QueueMessage } from "../../../services/queue.js";
import {
	getJid,
	getMessageCaption,
	sendWithTyping,
} from "../../../supports/message.js";
import type { MessagePattern } from "../../../types/MessagePattern.js";
import ClearGeminiHistoryIfNeededAction from "./ClearGeminiHistoryIfNeededAction.js";

export default class extends GeminiMessageHandlerAction {
	patterns(): MessagePattern {
		return true;
	}

	async isEligibleToProcess(
		socket: WASocket,
		message: WAMessage
	): Promise<boolean> {
		const jid = getJid(message);
		return (
			!message.key.fromMe &&
			DB.data.gemini[process.env.BOT_NAME!][jid] !== undefined &&
			DB.data.gemini[process.env.BOT_NAME!][jid].active
		);
	}

	async process(socket: WASocket, message: WAMessage): Promise<void> {
		await new ClearGeminiHistoryIfNeededAction().execute();

		const jid = getJid(message);
		const caption = getMessageCaption(message.message!);

		if (caption?.length > 1) {
			const key = this.getKey();
			const genAI = new GoogleGenerativeAI(key);
			const model = genAI.getGenerativeModel({
				model: "gemini-pro",
				generationConfig: {
					temperature: 1,
				},
				safetySettings: [
					{
						category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
						threshold: HarmBlockThreshold.BLOCK_NONE,
					},
					{
						category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
						threshold: HarmBlockThreshold.BLOCK_NONE,
					},
					{
						category: HarmCategory.HARM_CATEGORY_HARASSMENT,
						threshold: HarmBlockThreshold.BLOCK_NONE,
					},
					{
						category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
						threshold: HarmBlockThreshold.BLOCK_NONE,
					},
				],
			});

			const chat = model.startChat({
				history: this.getHistory(jid),
			});

			const response = await chat.sendMessage(caption);

			const text = response.response.text().trim();

			QueueMessage.add(async () => {
				await sendWithTyping(
					socket,
					{
						text: text,
					},
					jid,
					{ quoted: message }
				);
				await this.addHistory({ input: caption, jid });
				await this.addHistory({ output: text, jid });
			});
		}
	}

	protected getHistory(jid: string) {
		const rules = DB.data.gemini[process.env.BOT_NAME!][jid].rules || [];

		const history: InputContent[] = rules.length
			? [
					{
						role: "user",
						parts: rules.join("\n\n\n"),
					},
			  ]
			: [];
		// jika ada rules, maka tambahkan pesan "okay, i will remember that." untuk role model
		if (history.length > 0)
			history.push({ role: "model", parts: "okay, i will remember that." });

		DB.data.gemini[process.env.BOT_NAME!][jid].history.map(
			({ input, output }) => {
				history.push({
					role: !!input ? "user" : "model",
					parts: input || output || "",
				});
			}
		);

		return history;
	}

	protected async addHistory({
		input,
		jid,
		output,
	}: {
		input?: string;
		output?: string;
		jid: string;
	}) {
		if (DB.data.gemini[process.env.BOT_NAME!][jid].history === undefined) {
			DB.data.gemini[process.env.BOT_NAME!][jid].history = [];
		}
		DB.data.gemini[process.env.BOT_NAME!][jid].history.push({
			input,
			output,
			timestamp: Date.now(),
		});
		await Queue.add(() => DB.write());
	}
}
