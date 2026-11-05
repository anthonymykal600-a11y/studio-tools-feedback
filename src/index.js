export default {
    async fetch(request, env) {
        if (request.method !== "POST") {
            return Response.json({
                success: false,
                error: "POST requests only"
            }, { status: 405 });
        }

        try {
            const data = await request.json();

            const allowedCategories = [
                "Bug Report",
                "Feature Suggestion",
                "General Feedback"
            ];

            if (!allowedCategories.includes(data.category)) {
                return Response.json({
                    success: false,
                    error: "Invalid category"
                }, { status: 400 });
            }

            if (
                typeof data.description !== "string" ||
                data.description.trim().length < 5 ||
                data.description.length > 2000
            ) {
                return Response.json({
                    success: false,
                    error: "Description must be 5–2000 characters"
                }, { status: 400 });
            }

            const discordResponse = await fetch(env.DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    embeds: [{
                        title: data.category,
                        color: 3447003,
                        fields: [
                            {
                                name: "Tool",
                                value: String(data.tool || "Other").slice(0, 100),
                                inline: true
                            },
                            {
                                name: "Description",
                                value: data.description.trim().slice(0, 2000)
                            },
                            {
                                name: "Plugin Version",
                                value: String(data.version || "Unknown"),
                                inline: true
                            }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                })
            });

            if (!discordResponse.ok) {
                throw new Error("Discord webhook rejected the report");
            }

            return Response.json({
                success: true,
                message: "Feedback submitted"
            });

        } catch (error) {
            return Response.json({
                success: false,
                error: "Could not submit feedback"
            }, { status: 500 });
        }
    }
};
