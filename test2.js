const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const http = require("http");

// ==========================================================
// SERWER HTTP — RENDER
// ==========================================================

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Discord Ticket Bot działa!");
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Serwer HTTP działa na porcie ${PORT}`);
});

// ==========================================================
// USTAWIENIA
// ==========================================================

const TOKEN = process.env.DISCORD_TOKEN;

const DATA_DIR = process.env.DATA_DIR || __dirname;
const CONFIG_FILE = path.join(DATA_DIR, "ticket-config.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ==========================================================
// KLIENT DISCORD
// ==========================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Channel
    ]
});

// ==========================================================
// DOMYŚLNA KONFIGURACJA
// ==========================================================

const defaultConfig = {
    supportRoleIds: [],

    ticketCategoryId: null,

    transcriptChannelId: null,

    ticketPanel: {
        title: "🎫 SYSTEM TICKETÓW",
        description: "Wybierz rodzaj zgłoszenia:",
        placeholder: "📁 Wybierz kategorię"
    },

    categories: [
        {
            id: "pomoc",
            name: "Pomoc",
            emoji: "🆘",
            description: "Potrzebuję pomocy",
            questions: [
                "W czym potrzebujesz pomocy?",
                "Od kiedy występuje problem?"
            ]
        },

        {
            id: "zgloszenie",
            name: "Zgłoszenie",
            emoji: "🚨",
            description: "Chcę zgłosić gracza",
            questions: [
                "Kogo zgłaszasz?",
                "Jaki jest powód zgłoszenia?",
                "Podaj dowody."
            ]
        },

        {
            id: "sklep",
            name: "Sklep",
            emoji: "🛒",
            description: "Problem ze sklepem",
            questions: [
                "Czego dotyczy problem?",
                "Podaj numer zamówienia."
            ]
        },

        {
            id: "odwolanie",
            name: "Odwołanie",
            emoji: "⚖️",
            description: "Odwołanie od bana lub innej kary",
            questions: [
                "Jaki jest Twój nick?",
                "Za co otrzymałeś karę?",
                "Dlaczego uważasz, że kara jest niesłuszna?"
            ]
        },

        {
            id: "inne",
            name: "Inne",
            emoji: "📌",
            description: "Inna sprawa",
            questions: [
                "Opisz swoją sprawę."
            ]
        }
    ]
};

// ==========================================================
// ID
// ==========================================================

function makeId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 8)
    );
}

// ==========================================================
// ŁADOWANIE KONFIGURACJI
// ==========================================================

function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.writeFileSync(
            CONFIG_FILE,
            JSON.stringify(defaultConfig, null, 4),
            "utf8"
        );

        return JSON.parse(JSON.stringify(defaultConfig));
    }

    try {
        const data = JSON.parse(
            fs.readFileSync(CONFIG_FILE, "utf8")
        );

        const config = {
            ...defaultConfig,
            ...data
        };

        if (!Array.isArray(config.categories)) {
            config.categories = [];
        }

        if (!Array.isArray(config.supportRoleIds)) {
            config.supportRoleIds = [];
        }

        if (
            !config.ticketPanel ||
            typeof config.ticketPanel !== "object"
        ) {
            config.ticketPanel = {
                ...defaultConfig.ticketPanel
            };
        }

        if (typeof config.ticketPanel.title !== "string") {
            config.ticketPanel.title =
                defaultConfig.ticketPanel.title;
        }

        if (
            typeof config.ticketPanel.description !== "string"
        ) {
            config.ticketPanel.description =
                defaultConfig.ticketPanel.description;
        }

        if (
            typeof config.ticketPanel.placeholder !== "string"
        ) {
            config.ticketPanel.placeholder =
                defaultConfig.ticketPanel.placeholder;
        }

        config.categories = config.categories.map(category => {
            if (!category.id) {
                category.id = makeId();
            }

            if (typeof category.name !== "string") {
                category.name = "Nowa kategoria";
            }

            if (typeof category.emoji !== "string") {
                category.emoji = "📁";
            }

            if (typeof category.description !== "string") {
                category.description = "";
            }

            if (!Array.isArray(category.questions)) {
                category.questions = [];
            }

            return category;
        });

        return config;
    } catch (error) {
        console.error(
            "❌ Błąd odczytu konfiguracji:",
            error
        );

        return JSON.parse(
            JSON.stringify(defaultConfig)
        );
    }
}

let config = loadConfig();

// ==========================================================
// ZAPIS
// ==========================================================

function saveConfig() {
    try {
        fs.writeFileSync(
            CONFIG_FILE,
            JSON.stringify(config, null, 4),
            "utf8"
        );

        return true;
    } catch (error) {
        console.error(
            "❌ Błąd zapisu konfiguracji:",
            error
        );

        return false;
    }
}

// ==========================================================
// POMOCNICZE
// ==========================================================

function isAdmin(member) {
    return !!(
        member &&
        member.permissions &&
        member.permissions.has(
            PermissionsBitField.Flags.Administrator
        )
    );
}

function getCategory(categoryId) {
    return config.categories.find(
        category => category.id === categoryId
    );
}

function safeChannelName(text) {
    return text
        .toLowerCase()
        .replace(
            /[^a-z0-9ąćęłńóśźż_-]/gi,
            "-"
        )
        .replace(/-+/g, "-")
        .substring(0, 70);
}

// ==========================================================
// PUBLICZNY PANEL
// ==========================================================

function createTicketPanel() {
    const panel =
        config.ticketPanel ||
        defaultConfig.ticketPanel;

    const embed = new EmbedBuilder()
        .setTitle(
            (panel.title || "🎫 SYSTEM TICKETÓW")
                .substring(0, 256)
        )
        .setDescription(
            (panel.description || "Wybierz kategorię:")
                .substring(0, 4096)
        )
        .setColor(0x2ecc71);

    const options = config.categories
        .slice(0, 25)
        .map(category => {
            const option =
                new StringSelectMenuOptionBuilder()
                    .setLabel(
                        category.name.substring(0, 100)
                    )
                    .setValue(category.id)
                    .setDescription(
                        (
                            category.description ||
                            "Otwórz ticket"
                        ).substring(0, 100)
                    );

            if (category.emoji) {
                option.setEmoji(category.emoji);
            }

            return option;
        });

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                "ticket_category_select_public"
            )
            .setPlaceholder(
                (
                    panel.placeholder ||
                    "📁 Wybierz kategorię"
                ).substring(0, 150)
            )
            .addOptions(options);

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(menu)
        ]
    };
}

// ==========================================================
// PANEL ADMINA
// ==========================================================

function createAdminPanel() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("admin_ticket_panel")
            .setLabel("📝 Panel ticketów")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("admin_categories")
            .setLabel("📁 Kategorie")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("admin_questions")
            .setLabel("❓ Pytania")
            .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("admin_roles")
            .setLabel("👥 Role obsługi")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("admin_ticket_category")
            .setLabel("📂 Kategoria kanałów")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("admin_transcripts")
            .setLabel("📜 Transkrypcje")
            .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("admin_info")
            .setLabel("ℹ️ Informacje")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("admin_close_panel")
            .setLabel("❌ Zamknij")
            .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2, row3];
}

// ==========================================================
// MODAL PANELU
// ==========================================================

function ticketPanelModal() {
    const modal = new ModalBuilder()
        .setCustomId("ticket_panel_modal")
        .setTitle("📝 Edytuj panel ticketów");

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("panel_title")
                .setLabel("Tytuł panelu")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(256)
                .setValue(
                    config.ticketPanel.title || ""
                )
        ),

        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("panel_description")
                .setLabel("Opis panelu")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(4000)
                .setValue(
                    config.ticketPanel.description || ""
                )
        ),

        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("panel_placeholder")
                .setLabel("Tekst rozwijanego menu")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(150)
                .setValue(
                    config.ticketPanel.placeholder || ""
                )
        )
    );

    return modal;
}

// ==========================================================
// MODAL DODAWANIA KATEGORII
// ==========================================================

function addCategoryModal() {
    const modal = new ModalBuilder()
        .setCustomId("category_add_modal")
        .setTitle("📁 Dodaj kategorię");

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("category_name")
                .setLabel("Nazwa kategorii")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
        ),

        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("category_emoji")
                .setLabel("Emotka kategorii")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setValue("📁")
        ),

        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("category_description")
                .setLabel("Opis kategorii")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(100)
        )
    );

    return modal;
}

// ==========================================================
// MODAL EDYCJI KATEGORII
// ==========================================================

function editCategoryModal(category) {
    const modal = new ModalBuilder()
        .setCustomId(
            `category_edit_modal_${category.id}`
        )
        .setTitle("✏️ Edytuj kategorię");

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("category_name")
                .setLabel("Nazwa kategorii")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setValue(category.name.substring(0, 100))
        ),

        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("category_emoji")
                .setLabel("Emotka kategorii")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
                .setValue(category.emoji || "📁")
        ),

        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("category_description")
                .setLabel("Opis kategorii")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(100)
                .setValue(category.description || "")
        )
    );

    return modal;
}

// ==========================================================
// MENU KATEGORII
// ==========================================================

function categoryAdminMenu(customId) {
    const options = config.categories
        .slice(0, 25)
        .map(category => {
            const option =
                new StringSelectMenuOptionBuilder()
                    .setLabel(
                        category.name.substring(0, 100)
                    )
                    .setValue(category.id);

            if (category.emoji) {
                option.setEmoji(category.emoji);
            }

            return option;
        });

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder("📁 Wybierz kategorię")
            .addOptions(options)
    );
}

function questionCategoryMenu() {
    return categoryAdminMenu(
        "admin_question_category"
    );
}

// ==========================================================
// PYTANIA
// ==========================================================

function addQuestionModal(categoryId) {
    const modal = new ModalBuilder()
        .setCustomId(
            `question_add_modal_${categoryId}`
        )
        .setTitle("❓ Dodaj pytanie");

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("question_text")
                .setLabel("Treść pytania")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(4000)
        )
    );

    return modal;
}

function editQuestionModal(categoryId, index) {
    const category = getCategory(categoryId);
    const question = category?.questions?.[index];

    const modal = new ModalBuilder()
        .setCustomId(
            `question_edit_modal_${categoryId}_${index}`
        )
        .setTitle("✏️ Edytuj pytanie");

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("question_text")
                .setLabel("Treść pytania")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(4000)
                .setValue(question || "")
        )
    );

    return modal;
}

function questionSelectMenu(categoryId) {
    const category = getCategory(categoryId);

    const options = category.questions
        .slice(0, 25)
        .map((question, index) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(
                    `${index + 1}. ${question}`.substring(0, 100)
                )
                .setValue(String(index))
        );

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(
                `admin_question_manage_${categoryId}`
            )
            .setPlaceholder("❓ Wybierz pytanie")
            .addOptions(options)
    );
}

// ==========================================================
// FORMULARZ TICKETU
// ==========================================================

function createTicketModal(category) {
    const questions = (category.questions || []).slice(0, 5);

    const modal = new ModalBuilder()
        .setCustomId(
            `ticket_questions_modal_${category.id}`
        )
        .setTitle(category.name.substring(0, 45));

    questions.forEach((question, index) => {
        const input = new TextInputBuilder()
            .setCustomId(`answer_${index}`)
            .setLabel(
                question.substring(0, 45)
            )
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );
    });

    return modal;
}

// ==========================================================
// TWORZENIE TICKETU
// ==========================================================

async function createTicketAfterForm(
    interaction,
    category,
    answers
) {
    const guild = interaction.guild;

    if (!guild) {
        return null;
    }

    const existing = guild.channels.cache.find(
        channel =>
            channel.topic ===
            `ticket-owner:${interaction.user.id}`
    );

    if (existing) {
        return {
            error:
                `❌ Masz już otwarty ticket: ${existing}`
        };
    }

    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [
                PermissionsBitField.Flags.ViewChannel
            ]
        },

        {
            id: interaction.user.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles
            ]
        }
    ];

    for (const roleId of config.supportRoleIds) {
        const role = guild.roles.cache.get(roleId);

        if (!role) {
            continue;
        }

        permissionOverwrites.push({
            id: role.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles
            ]
        });
    }

    const channelName = safeChannelName(
        `${category.name}-${interaction.user.username}`
    );

    const channelOptions = {
        name: `ticket-${channelName}`.substring(0, 100),
        type: ChannelType.GuildText,
        topic:
            `ticket-owner:${interaction.user.id}`,
        permissionOverwrites,
        reason:
            `Ticket utworzony przez ${interaction.user.tag}`
    };

    if (config.ticketCategoryId) {
        const parent =
            guild.channels.cache.get(
                config.ticketCategoryId
            );

        if (
            parent &&
            parent.type === ChannelType.GuildCategory
        ) {
            channelOptions.parent = parent.id;
        }
    }

    let channel;

    try {
        channel =
            await guild.channels.create(
                channelOptions
            );
    } catch (error) {
        console.error(
            "❌ Błąd tworzenia ticketu:",
            error
        );

        return {
            error:
                "❌ Nie udało się utworzyć kanału ticketu."
        };
    }

    let supportMention = "";

    for (const roleId of config.supportRoleIds) {
        supportMention += `<@&${roleId}> `;
    }

    const embed = new EmbedBuilder()
        .setTitle(
            `${category.emoji || "📁"} ${category.name}`
        )
        .setDescription(
            `Ticket utworzony przez ${interaction.user}\n\n` +
            `Kategoria: **${category.name}**`
        )
        .setColor(0x3498db)
        .setTimestamp();

    const buttons =
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_claim")
                .setLabel("🙋 Przejmij ticket")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("ticket_close")
                .setLabel("🔒 Zamknij ticket")
                .setStyle(ButtonStyle.Danger)
        );

    await channel.send({
        content:
            `${interaction.user} ${supportMention}`.trim(),
        embeds: [embed],
        components: [buttons]
    });

    let answersText =
        "📝 **ODPOWIEDZI Z FORMULARZA**\n\n";

    category.questions
        .slice(0, 5)
        .forEach((question, index) => {
            const answer =
                answers[index] ||
                "Brak odpowiedzi";

            answersText +=
                `**${index + 1}. ${question}**\n`;
            answersText += `${answer}\n\n`;
        });

    const answersEmbed = new EmbedBuilder()
        .setTitle("📝 Odpowiedzi do zgłoszenia")
        .setDescription(
            answersText.substring(0, 4096)
        )
        .setColor(0x2ecc71)
        .setFooter({
            text:
                `Ticket użytkownika ${interaction.user.tag}`
        })
        .setTimestamp();

    await channel.send({
        embeds: [answersEmbed]
    });

    return {
        channel
    };
}

// ==========================================================
// TRANSKRYPCJA
// ==========================================================

async function createTranscript(channel, closer) {
    let messages = [];
    let lastId;

    try {
        while (true) {
            const fetched =
                await channel.messages.fetch({
                    limit: 100,
                    ...(lastId
                        ? { before: lastId }
                        : {})
                });

            if (fetched.size === 0) {
                break;
            }

            messages.push(...fetched.values());

            lastId = fetched.last().id;

            if (fetched.size < 100) {
                break;
            }

            if (messages.length >= 10000) {
                break;
            }
        }
    } catch (error) {
        console.error(
            "❌ Błąd pobierania wiadomości:",
            error
        );
    }

    messages.reverse();

    const ownerMatch =
        channel.topic?.match(
            /ticket-owner:(\d+)/
        );

    const ownerId =
        ownerMatch
            ? ownerMatch[1]
            : "Nieznany";

    let text = "";

    text +=
        "============================================================\n";
    text +=
        "                    TRANSKRYPCJA TICKETU\n";
    text +=
        "============================================================\n\n";

    text += `Kanał: ${channel.name}\n`;
    text += `ID kanału: ${channel.id}\n`;
    text += `ID właściciela: ${ownerId}\n`;
    text += `Zamknięty przez: ${closer.tag}\n`;
    text += `ID zamykającego: ${closer.id}\n`;
    text +=
        `Data zamknięcia: ${new Date().toLocaleString("pl-PL")}\n`;
    text +=
        `Liczba wiadomości: ${messages.length}\n\n`;

    text +=
        "============================================================\n";
    text +=
        "                         WIADOMOŚCI\n";
    text +=
        "============================================================\n\n";

    for (const message of messages) {
        const date =
            message.createdAt.toLocaleString(
                "pl-PL"
            );

        text +=
            `[${date}] ${message.author.tag} (${message.author.id})\n`;

        if (message.content) {
            text += `${message.content}\n`;
        }

        if (message.attachments.size > 0) {
            text += "Załączniki:\n";

            for (
                const attachment
                of message.attachments.values()
            ) {
                text +=
                    `- ${attachment.name || "plik"}: ${attachment.url}\n`;
            }
        }

        if (message.embeds.length > 0) {
            text +=
                `[Embedów: ${message.embeds.length}]\n`;
        }

        text += "\n";
    }

    text +=
        "============================================================\n";
    text +=
        "                         KONIEC\n";
    text +=
        "============================================================\n";

    return Buffer.from(text, "utf8");
}

// ==========================================================
// READY
// ==========================================================

client.once("ready", () => {
    console.log(
        `✅ Zalogowano jako ${client.user.tag}`
    );

    console.log(
        `🌐 HTTP działa na porcie ${PORT}`
    );

    console.log(
        `📁 Konfiguracja: ${CONFIG_FILE}`
    );

    console.log(
        `📂 Kategorii: ${config.categories.length}`
    );
});

// ==========================================================
// KOMENDY
// ==========================================================

client.on("messageCreate", async message => {
    if (message.author.bot) {
        return;
    }

    if (!message.guild) {
        return;
    }

    // !ticket
    if (message.content === "!ticket") {
        if (!isAdmin(message.member)) {
            return message.reply(
                "❌ Tylko administrator może wysłać panel ticketów."
            );
        }

        await message.channel.send(
            createTicketPanel()
        );

        return;
    }

    // !panel
    if (message.content === "!panel") {
        if (!isAdmin(message.member)) {
            return message.reply(
                "❌ Tylko administrator może używać tej komendy."
            );
        }

        try {
            await message.author.send({
                content:
                    "🎛️ **PANEL ADMINISTRATORA TICKETÓW**",
                components:
                    createAdminPanel()
            });

            await message.delete().catch(() => {});
        } catch (error) {
            console.error(error);

            await message.reply(
                "❌ Nie mogę wysłać Ci panelu w wiadomości prywatnej."
            );
        }

        return;
    }

    // !roleadd
    if (message.content.startsWith("!roleadd ")) {
        if (!isAdmin(message.member)) {
            return;
        }

        const roleId =
            message.content.split(/\s+/)[1];

        const role =
            message.guild.roles.cache.get(roleId);

        if (!role) {
            return message.reply(
                "❌ Nie znaleziono takiej roli."
            );
        }

        if (
            !config.supportRoleIds.includes(role.id)
        ) {
            config.supportRoleIds.push(role.id);
            saveConfig();
        }

        return message.reply(
            `✅ Dodano rolę obsługi: ${role}`
        );
    }

    // !roledel
    if (message.content.startsWith("!roledel ")) {
        if (!isAdmin(message.member)) {
            return;
        }

        const roleId =
            message.content.split(/\s+/)[1];

        config.supportRoleIds =
            config.supportRoleIds.filter(
                id => id !== roleId
            );

        saveConfig();

        return message.reply(
            "✅ Usunięto rolę obsługi."
        );
    }

    // !ticketcategory
    if (
        message.content.startsWith(
            "!ticketcategory "
        )
    ) {
        if (!isAdmin(message.member)) {
            return;
        }

        const categoryId =
            message.content.split(/\s+/)[1];

        const category =
            message.guild.channels.cache.get(
                categoryId
            );

        if (
            !category ||
            category.type !== ChannelType.GuildCategory
        ) {
            return message.reply(
                "❌ Podane ID nie jest kategorią kanałów Discord."
            );
        }

        config.ticketCategoryId =
            category.id;

        saveConfig();

        return message.reply(
            `✅ Ustawiono kategorię kanałów ticketów: ${category}`
        );
    }

    // !transcriptchannel
    if (
        message.content.startsWith(
            "!transcriptchannel "
        )
    ) {
        if (!isAdmin(message.member)) {
            return;
        }

        const channelId =
            message.content.split(/\s+/)[1];

        const channel =
            message.guild.channels.cache.get(
                channelId
            );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return message.reply(
                "❌ Nie znaleziono kanału tekstowego."
            );
        }

        config.transcriptChannelId =
            channel.id;

        saveConfig();

        return message.reply(
            `✅ Ustawiono kanał transkrypcji: ${channel}`
        );
    }
});

// ==========================================================
// INTERAKCJE
// ==========================================================

client.on(
    "interactionCreate",
    async interaction => {
        try {

            // ==================================================
            // PUBLICZNY WYBÓR KATEGORII
            // ==================================================

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                    "ticket_category_select_public"
            ) {
                const categoryId =
                    interaction.values[0];

                const category =
                    getCategory(categoryId);

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Ta kategoria już nie istnieje.",
                        ephemeral: true
                    });
                }

                if (
                    !category.questions ||
                    category.questions.length === 0
                ) {
                    return interaction.reply({
                        content:
                            "❌ Ta kategoria nie ma jeszcze skonfigurowanych pytań.",
                        ephemeral: true
                    });
                }

                const existing =
                    interaction.guild.channels.cache.find(
                        channel =>
                            channel.topic ===
                            `ticket-owner:${interaction.user.id}`
                    );

                if (existing) {
                    return interaction.reply({
                        content:
                            `❌ Masz już otwarty ticket: ${existing}`,
                        ephemeral: true
                    });
                }

                // ==================================================
                // WAŻNE:
                // TUTAJ NIE TWORZYMY KANAŁU.
                // OD RAZU POKAZUJEMY MODAL.
                // ==================================================

                return interaction.showModal(
                    createTicketModal(category)
                );
            }

            // ==================================================
            // SUBMIT FORMULARZA
            // DOPIERO TUTAJ POWSTAJE KANAŁ
            // ==================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith(
                    "ticket_questions_modal_"
                )
            ) {
                const categoryId =
                    interaction.customId.replace(
                        "ticket_questions_modal_",
                        ""
                    );

                const category =
                    getCategory(categoryId);

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                const answers = [];

                category.questions
                    .slice(0, 5)
                    .forEach((question, index) => {
                        answers.push(
                            interaction.fields
                                .getTextInputValue(
                                    `answer_${index}`
                                )
                        );
                    });

                const result =
                    await createTicketAfterForm(
                        interaction,
                        category,
                        answers
                    );

                if (
                    !result ||
                    result.error
                ) {
                    return interaction.reply({
                        content:
                            result?.error ||
                            "❌ Nie udało się utworzyć ticketu.",
                        ephemeral: true
                    });
                }

                return interaction.reply({
                    content:
                        `✅ Ticket został utworzony: ${result.channel}`,
                    ephemeral: true
                });
            }

            // ==================================================
            // ADMIN PANEL
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_ticket_panel"
            ) {
                return interaction.showModal(
                    ticketPanelModal()
                );
            }

            // ==================================================
            // KATEGORIE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_categories"
            ) {
                const row =
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                "admin_category_add"
                            )
                            .setLabel(
                                "➕ Dodaj kategorię"
                            )
                            .setStyle(
                                ButtonStyle.Success
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                "admin_category_edit"
                            )
                            .setLabel(
                                "✏️ Edytuj kategorię"
                            )
                            .setStyle(
                                ButtonStyle.Primary
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                "admin_category_delete"
                            )
                            .setLabel(
                                "🗑️ Usuń kategorię"
                            )
                            .setStyle(
                                ButtonStyle.Danger
                            )
                    );

                return interaction.reply({
                    content:
                        "📁 **ZARZĄDZANIE KATEGORIAMI**\n\n" +
                        "Możesz dodawać, edytować i usuwać kategorie.\n\n" +
                        "Każda kategoria ma własną nazwę, emotkę, opis i pytania.",
                    components: [row],
                    ephemeral: true
                });
            }

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_category_add"
            ) {
                if (config.categories.length >= 25) {
                    return interaction.reply({
                        content:
                            "❌ Maksymalnie 25 kategorii.",
                        ephemeral: true
                    });
                }

                return interaction.showModal(
                    addCategoryModal()
                );
            }

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_category_edit"
            ) {
                if (config.categories.length === 0) {
                    return interaction.reply({
                        content:
                            "❌ Brak kategorii.",
                        ephemeral: true
                    });
                }

                return interaction.reply({
                    content:
                        "✏️ Wybierz kategorię do edycji:",
                    components: [
                        categoryAdminMenu(
                            "admin_category_edit_select"
                        )
                    ],
                    ephemeral: true
                });
            }

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_category_delete"
            ) {
                if (config.categories.length === 0) {
                    return interaction.reply({
                        content:
                            "❌ Brak kategorii.",
                        ephemeral: true
                    });
                }

                return interaction.reply({
                    content:
                        "🗑️ Wybierz kategorię do usunięcia:",
                    components: [
                        categoryAdminMenu(
                            "admin_category_delete_select"
                        )
                    ],
                    ephemeral: true
                });
            }

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                    "admin_category_edit_select"
            ) {
                const category =
                    getCategory(
                        interaction.values[0]
                    );

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                return interaction.showModal(
                    editCategoryModal(category)
                );
            }

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                    "admin_category_delete_select"
            ) {
                const categoryId =
                    interaction.values[0];

                const category =
                    getCategory(categoryId);

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                config.categories =
                    config.categories.filter(
                        category =>
                            category.id !== categoryId
                    );

                saveConfig();

                return interaction.update({
                    content:
                        `🗑️ Usunięto kategorię **${category.emoji} ${category.name}**.`,
                    components: []
                });
            }

            // ==================================================
            // PYTANIA
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_questions"
            ) {
                if (config.categories.length === 0) {
                    return interaction.reply({
                        content:
                            "❌ Najpierw utwórz kategorię.",
                        ephemeral: true
                    });
                }

                return interaction.reply({
                    content:
                        "❓ Wybierz kategorię:",
                    components: [
                        questionCategoryMenu()
                    ],
                    ephemeral: true
                });
            }

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId ===
                    "admin_question_category"
            ) {
                const category =
                    getCategory(
                        interaction.values[0]
                    );

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                const buttons =
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `admin_question_add_${category.id}`
                            )
                            .setLabel(
                                "➕ Dodaj pytanie"
                            )
                            .setStyle(
                                ButtonStyle.Success
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `admin_question_edit_${category.id}`
                            )
                            .setLabel(
                                "✏️ Edytuj pytanie"
                            )
                            .setStyle(
                                ButtonStyle.Primary
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                `admin_question_delete_${category.id}`
                            )
                            .setLabel(
                                "🗑️ Usuń pytanie"
                            )
                            .setStyle(
                                ButtonStyle.Danger
                            )
                    );

                const questionList =
                    category.questions.length
                        ? category.questions
                            .map(
                                (question, index) =>
                                    `**${index + 1}.** ${question}`
                            )
                            .join("\n")
                        : "Brak pytań.";

                return interaction.update({
                    content:
                        `❓ **PYTANIA — ${category.emoji} ${category.name}**\n\n` +
                        questionList,
                    components: [buttons]
                });
            }

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "admin_question_add_"
                )
            ) {
                const categoryId =
                    interaction.customId.replace(
                        "admin_question_add_",
                        ""
                    );

                const category =
                    getCategory(categoryId);

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                if (category.questions.length >= 5) {
                    return interaction.reply({
                        content:
                            "❌ Maksymalnie 5 pytań w jednej kategorii.",
                        ephemeral: true
                    });
                }

                return interaction.showModal(
                    addQuestionModal(categoryId)
                );
            }

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "admin_question_edit_"
                )
            ) {
                const categoryId =
                    interaction.customId.replace(
                        "admin_question_edit_",
                        ""
                    );

                const category =
                    getCategory(categoryId);

                if (
                    !category ||
                    category.questions.length === 0
                ) {
                    return interaction.reply({
                        content:
                            "❌ Ta kategoria nie ma pytań.",
                        ephemeral: true
                    });
                }

                return interaction.reply({
                    content:
                        "✏️ Wybierz pytanie:",
                    components: [
                        questionSelectMenu(
                            categoryId
                        )
                    ],
                    ephemeral: true
                });
            }

            if (
                interaction.isButton() &&
                interaction.customId.startsWith(
                    "admin_question_delete_"
                )
            ) {
                const categoryId =
                    interaction.customId.replace(
                        "admin_question_delete_",
                        ""
                    );

                const category =
                    getCategory(categoryId);

                if (
                    !category ||
                    category.questions.length === 0
                ) {
                    return interaction.reply({
                        content:
                            "❌ Ta kategoria nie ma pytań.",
                        ephemeral: true
                    });
                }

                return interaction.reply({
                    content:
                        "🗑️ Wybierz pytanie do usunięcia:",
                    components: [
                        questionSelectMenu(
                            categoryId
                        )
                    ],
                    ephemeral: true
                });
            }

            if (
                interaction.isStringSelectMenu() &&
                interaction.customId.startsWith(
                    "admin_question_manage_"
                )
            ) {
                const categoryId =
                    interaction.customId.replace(
                        "admin_question_manage_",
                        ""
                    );

                const category =
                    getCategory(categoryId);

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                const index =
                    Number(interaction.values[0]);

                const messageContent =
                    interaction.message.content || "";

                if (
                    messageContent.includes(
                        "usunięcia"
                    )
                ) {
                    const removed =
                        category.questions.splice(
                            index,
                            1
                        );

                    saveConfig();

                    return interaction.update({
                        content:
                            `🗑️ Usunięto pytanie:\n\n${removed[0] || ""}`,
                        components: []
                    });
                }

                return interaction.showModal(
                    editQuestionModal(
                        categoryId,
                        index
                    )
                );
            }

            // ==================================================
            // ROLE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_roles"
            ) {
                return interaction.reply({
                    content:
                        "👥 **ROLE OBSŁUGI**\n\n" +
                        "Dodawanie:\n" +
                        "`!roleadd ID_ROLE`\n\n" +
                        "Usuwanie:\n" +
                        "`!roledel ID_ROLE`\n\n" +
                        "Aktualne role:\n" +
                        (
                            config.supportRoleIds.length
                                ? config.supportRoleIds
                                    .map(
                                        id =>
                                            `<@&${id}>`
                                    )
                                    .join("\n")
                                : "Brak"
                        ),
                    ephemeral: true
                });
            }

            // ==================================================
            // KATEGORIA KANAŁÓW
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_ticket_category"
            ) {
                return interaction.reply({
                    content:
                        "📂 **KATEGORIA KANAŁÓW TICKETÓW**\n\n" +
                        "Użyj:\n" +
                        "`!ticketcategory ID_KATEGORII`\n\n" +
                        "Aktualnie:\n" +
                        (
                            config.ticketCategoryId
                                ? `<#${config.ticketCategoryId}>`
                                : "Brak"
                        ),
                    ephemeral: true
                });
            }

            // ==================================================
            // TRANSKRYPCJE
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_transcripts"
            ) {
                return interaction.reply({
                    content:
                        "📜 **TRANSKRYPCJE**\n\n" +
                        "Użyj:\n" +
                        "`!transcriptchannel ID_KANAŁU`\n\n" +
                        "Aktualnie:\n" +
                        (
                            config.transcriptChannelId
                                ? `<#${config.transcriptChannelId}>`
                                : "Brak"
                        ),
                    ephemeral: true
                });
            }

            // ==================================================
            // INFO
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_info"
            ) {
                return interaction.reply({
                    content:
                        "ℹ️ **INFORMACJE**\n\n" +
                        `📁 Kategorie: **${config.categories.length}**\n` +
                        `👥 Role obsługi: **${config.supportRoleIds.length}**\n` +
                        `📂 Kategoria kanałów: ${
                            config.ticketCategoryId
                                ? `<#${config.ticketCategoryId}>`
                                : "brak"
                        }\n` +
                        `📜 Kanał transkrypcji: ${
                            config.transcriptChannelId
                                ? `<#${config.transcriptChannelId}>`
                                : "brak"
                        }\n\n` +
                        `📄 Konfiguracja:\n\`${CONFIG_FILE}\``,
                    ephemeral: true
                });
            }

            // ==================================================
            // ZAMKNIĘCIE PANELU
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "admin_close_panel"
            ) {
                return interaction.message
                    .delete()
                    .catch(() => {});
            }

            // ==================================================
            // PRZEJĘCIE TICKETU
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "ticket_claim"
            ) {
                const member =
                    interaction.member;

                const allowed =
                    isAdmin(member) ||
                    config.supportRoleIds.some(
                        roleId =>
                            member.roles?.cache.has(
                                roleId
                            )
                    );

                if (!allowed) {
                    return interaction.reply({
                        content:
                            "❌ Nie masz uprawnień do przejęcia tego ticketu.",
                        ephemeral: true
                    });
                }

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "🙋 Ticket przejęty"
                        )
                        .setDescription(
                            `Ticket został przejęty przez ${interaction.user}.`
                        )
                        .setColor(0xf1c40f)
                        .setTimestamp();

                await interaction.channel.send({
                    embeds: [embed]
                });

                return interaction.reply({
                    content:
                        "✅ Przejąłeś ten ticket.",
                    ephemeral: true
                });
            }

            // ==================================================
            // ZAMKNIĘCIE TICKETU
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "ticket_close"
            ) {
                if (
                    !isAdmin(
                        interaction.member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Tylko administrator może zamknąć ticket.",
                        ephemeral: true
                    });
                }

                await interaction.reply({
                    content:
                        "⏳ Tworzę transkrypcję i zamykam ticket...",
                    ephemeral: true
                });

                const transcript =
                    await createTranscript(
                        interaction.channel,
                        interaction.user
                    );

                if (
                    config.transcriptChannelId
                ) {
                    const transcriptChannel =
                        interaction.guild.channels.cache.get(
                            config.transcriptChannelId
                        );

                    if (
                        transcriptChannel &&
                        transcriptChannel.isTextBased()
                    ) {
                        const attachment =
                            new AttachmentBuilder(
                                transcript,
                                {
                                    name:
                                        `${interaction.channel.name}.txt`
                                }
                            );

                        await transcriptChannel.send({
                            content:
                                `📜 **Transkrypcja ticketu**\n` +
                                `Kanał: **${interaction.channel.name}**\n` +
                                `Zamknięty przez: ${interaction.user}`,
                            files: [attachment]
                        });
                    }
                }

                setTimeout(
                    async () => {
                        await interaction.channel
                            .delete(
                                "Ticket zamknięty"
                            )
                            .catch(() => {});
                    },
                    1500
                );

                return;
            }

            // ==================================================
            // MODAL PANELU
            // ==================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "ticket_panel_modal"
            ) {
                config.ticketPanel = {
                    title:
                        interaction.fields
                            .getTextInputValue(
                                "panel_title"
                            ),

                    description:
                        interaction.fields
                            .getTextInputValue(
                                "panel_description"
                            ),

                    placeholder:
                        interaction.fields
                            .getTextInputValue(
                                "panel_placeholder"
                            )
                };

                saveConfig();

                return interaction.reply({
                    content:
                        "✅ Panel ticketów został zapisany.\n\n" +
                        "Nowe ustawienia będą używane po wysłaniu `!ticket`.",
                    ephemeral: true
                });
            }

            // ==================================================
            // DODAWANIE KATEGORII
            // ==================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "category_add_modal"
            ) {
                if (config.categories.length >= 25) {
                    return interaction.reply({
                        content:
                            "❌ Maksymalnie 25 kategorii.",
                        ephemeral: true
                    });
                }

                const name =
                    interaction.fields
                        .getTextInputValue(
                            "category_name"
                        )
                        .trim();

                const emoji =
                    interaction.fields
                        .getTextInputValue(
                            "category_emoji"
                        )
                        .trim();

                const description =
                    interaction.fields
                        .getTextInputValue(
                            "category_description"
                        )
                        .trim();

                config.categories.push({
                    id: makeId(),
                    name,
                    emoji: emoji || "📁",
                    description,
                    questions: []
                });

                saveConfig();

                return interaction.reply({
                    content:
                        `✅ Dodano kategorię **${emoji || "📁"} ${name}**.`,
                    ephemeral: true
                });
            }

            // ==================================================
            // EDYCJA KATEGORII
            // ==================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith(
                    "category_edit_modal_"
                )
            ) {
                const categoryId =
                    interaction.customId.replace(
                        "category_edit_modal_",
                        ""
                    );

                const category =
                    getCategory(categoryId);

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                category.name =
                    interaction.fields
                        .getTextInputValue(
                            "category_name"
                        )
                        .trim();

                category.emoji =
                    interaction.fields
                        .getTextInputValue(
                            "category_emoji"
                        )
                        .trim() || "📁";

                category.description =
                    interaction.fields
                        .getTextInputValue(
                            "category_description"
                        )
                        .trim();

                saveConfig();

                return interaction.reply({
                    content:
                        `✅ Zmieniono kategorię na **${category.emoji} ${category.name}**.`,
                    ephemeral: true
                });
            }

            // ==================================================
            // DODAWANIE PYTANIA
            // ==================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith(
                    "question_add_modal_"
                )
            ) {
                const categoryId =
                    interaction.customId.replace(
                        "question_add_modal_",
                        ""
                    );

                const category =
                    getCategory(categoryId);

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                if (category.questions.length >= 5) {
                    return interaction.reply({
                        content:
                            "❌ Maksymalnie 5 pytań w jednej kategorii.",
                        ephemeral: true
                    });
                }

                const question =
                    interaction.fields
                        .getTextInputValue(
                            "question_text"
                        )
                        .trim();

                category.questions.push(
                    question
                );

                saveConfig();

                return interaction.reply({
                    content:
                        "✅ Dodano pytanie.",
                    ephemeral: true
                });
            }

            // ==================================================
            // EDYCJA PYTANIA
            // ==================================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith(
                    "question_edit_modal_"
                )
            ) {
                const prefix =
                    "question_edit_modal_";

                const data =
                    interaction.customId.substring(
                        prefix.length
                    );

                const lastUnderscore =
                    data.lastIndexOf("_");

                const categoryId =
                    data.substring(
                        0,
                        lastUnderscore
                    );

                const questionIndex =
                    Number(
                        data.substring(
                            lastUnderscore + 1
                        )
                    );

                const category =
                    getCategory(categoryId);

                if (!category) {
                    return interaction.reply({
                        content:
                            "❌ Nie znaleziono kategorii.",
                        ephemeral: true
                    });
                }

                if (
                    !Number.isInteger(
                        questionIndex
                    ) ||
                    questionIndex < 0 ||
                    questionIndex >=
                        category.questions.length
                ) {
                    return interaction.reply({
                        content:
                            "❌ Nieprawidłowe pytanie.",
                        ephemeral: true
                    });
                }

                category.questions[
                    questionIndex
                ] =
                    interaction.fields
                        .getTextInputValue(
                            "question_text"
                        )
                        .trim();

                saveConfig();

                return interaction.reply({
                    content:
                        "✅ Pytanie zostało zmienione.",
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error(
                "❌ Błąd interactionCreate:",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ Wystąpił błąd podczas wykonywania operacji.",
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
);

// ==========================================================
// TOKEN
// ==========================================================

if (!TOKEN) {
    console.error(
        "❌ Brak DISCORD_TOKEN!"
    );

    console.error(
        "Ustaw DISCORD_TOKEN w Environment Variables na Renderze."
    );

    process.exit(1);
}

// ==========================================================
// START DISCORD
// ==========================================================

client.login(TOKEN);
