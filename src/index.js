export default {
	async fetch(request, env) {
		const json = (data, status = 200) =>
			new Response(JSON.stringify(data), {
				status,
				headers: {
					"Content-Type": "application/json",
				},
			});

		if (request.method !== "POST") {
			return json({
				success: false,
				error: "POST requests only",
			}, 405);
		}

		if (!env.DISCORD_WEBHOOK_URL) {
			return json({
				success: false,
				error: "Feedback service is not configured",
			}, 500);
		}

		const MAX_BODY_SIZE = 20 * 1024 * 1024;
		const MAX_ERRORS = 100;
		const MAX_ERROR_LENGTH = 4000;

		const contentLength = Number(
			request.headers.get("content-length") || 0
		);

		if (contentLength > MAX_BODY_SIZE) {
			return json({
				success: false,
				error: "Report is too large. Maximum upload size is 20 MB.",
			}, 413);
		}

		try {
			const body = await request.json();

			const allowedCategories = [
				"Bug Report",
				"Feature Suggestion",
				"General Feedback",
			];

			const allowedTools = [
				"Main Plugin",
				"Game Settings",
				"Lighting Profiles",
				"Explorer Folders",
				"Plugin Output",
				"Other",
			];

			if (!allowedCategories.includes(body.category)) {
				return json({
					success: false,
					error: "Invalid feedback category",
				}, 400);
			}

			if (
				typeof body.description !== "string"
				|| !body.description.trim()
			) {
				return json({
					success: false,
					error: "A report description is required",
				}, 400);
			}

			const description = body.description.trim();

			const tool = typeof body.tool === "string"
				&& allowedTools.includes(body.tool)
				? body.tool
				: "Unknown";

			const version = typeof body.version === "string"
				? body.version.slice(0, 32)
				: "Unknown";

			// Validate the Output errors sent by the plugin.
			const outputErrors = Array.isArray(body.outputErrors)
				? body.outputErrors
					.filter(error => typeof error === "string")
					.slice(0, MAX_ERRORS)
					.map(error => error.slice(0, MAX_ERROR_LENGTH))
				: [];

			const outputErrorText = outputErrors.length > 0
				? outputErrors.join("\n\n")
				: "No Output errors were captured for this report.";

			const preview = description.length > 3500
				? description.slice(0, 3500)
					+ "\n\nFull report attached as feedback.txt."
				: description;

			const discordPayload = {
				username: "Studio Tools Feedback",

				embeds: [
					{
						title: body.category,

						color: body.category === "Bug Report"
							? 0xE74C3C
							: body.category === "Feature Suggestion"
								? 0x3498DB
								: 0x2ECC71,

						fields: [
							{
								name: "Tool",
								value: tool || "Unknown",
								inline: true,
							},
							{
								name: "Version",
								value: version || "Unknown",
								inline: true,
							},
							{
								name: "Output Errors",
								value: String(outputErrors.length),
								inline: true,
							},
						],

						description: preview,

						footer: {
							text: "Studio Tools Feedback",
						},

						timestamp: new Date().toISOString(),
					},
				],
			};

			const form = new FormData();

			form.append(
				"payload_json",
				JSON.stringify(discordPayload)
			);

			form.append(
				"files[0]",
				new Blob([description], {
					type: "text/plain;charset=utf-8",
				}),
				"feedback.txt"
			);

			// Attach Output errors separately.
			if (outputErrors.length > 0) {
				form.append(
					"files[1]",
					new Blob([outputErrorText], {
						type: "text/plain;charset=utf-8",
					}),
					"output-errors.txt"
				);
			}

			const discordResponse = await fetch(
				env.DISCORD_WEBHOOK_URL,
				{
					method: "POST",
					body: form,
				}
			);

			if (!discordResponse.ok) {
				const errorText = await discordResponse.text();

				console.error(
					"Discord webhook error:",
					errorText
				);

				return json({
					success: false,
					error: "Discord could not receive the report",
				}, 502);
			}

			return json({
				success: true,
				message: "Feedback submitted",
				outputErrors: outputErrors.length,
			});
		} catch (error) {
			console.error("Feedback Worker error:", error);

			return json({
				success: false,
				error: "The feedback request could not be processed",
			}, 500);
		}
	},
};
