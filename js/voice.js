/* Imagination — Nova, the voice assistant.
   Listens with the Web Speech API, answers from the Imagination knowledge base,
   speaks back with speechSynthesis and can take visitors on a guided tour. */
(function () {
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------------- knowledge base ---------------- */
  const D = {
    en: {
      ui: { talk: 'Talk to Nova', open: 'Talk to Nova', state_idle: 'Tap the mic and talk', state_listen: 'Listening…', state_think: 'Thinking…', state_speak: 'Speaking…', state_tour: 'Touring the site…',
        ph: 'Or type your question…', s1: 'Give me a tour', s2: 'What can you do for my company?', s3: 'How much does it cost?', s4: 'Is my data safe?', stop: 'Stop', noMic: 'Voice input works in Chrome, Edge or Safari on a secure connection (like localhost). You can still type, and I will answer out loud.', micDenied: 'I need microphone permission to hear you. You can also type.', heard: 'Sorry, I didn’t catch that. Could you say it again?' },
      a: {
        greet: 'Hi! I’m Nova, the voice of Imagination. Ask me anything about our AI tools, our prices or how we can help your company. Or just say: give me a tour.',
        about: 'Imagination is one AI platform with seven tools: a reasoning engine, image creation and editing, a writer, a code generator, a customer service agent, smart payments and a CRM. Companies use it to do in seconds what used to take days.',
        services: 'Here is what we do. We create and edit images, write marketing and support texts, generate working code, answer your customers around the clock in over forty languages, process payments with AI fraud checks, and run your sales pipeline with an AI CRM. Which one interests you most?',
        pricing: 'There are three plans. Starter is free for up to three people. Team is 24 dollars per person per month and includes every tool and the CRM. Enterprise is custom, with private hosting and a dedicated success manager. Every plan starts with a free fourteen-day trial.',
        images: 'Vision Studio creates images from a single sentence and restyles photos: enhance, anime, pencil sketch, oil paint and more. Your photos are processed privately. I’m taking you there now.',
        code: 'Code Forge turns one sentence into working code with a live preview. Teams build landing pages and internal tools in hours instead of weeks. Here it is.',
        writing: 'The Writer creates product descriptions, customer replies and social posts in your tone and in any language, in seconds. Let me show you.',
        math: 'Race the AI is our reasoning demo. You solve an equation against the clock, then the AI solves it in microseconds and explains every step. Try to beat it!',
        support: 'Our customer agent answers your customers twenty-four seven in over forty languages. It tracks orders, issues refunds and recommends plans, and about 87 percent of conversations are solved without a human.',
        payments: 'Smart Payments checks every transaction with four AI risk signals in under a second, so good customers pay instantly and fraud gets blocked. Try the checkout demo right here.',
        crm: 'Pulse CRM scores your leads, forecasts your revenue and tells your team the next best move. Drag a deal in the demo and watch the forecast update.',
        roi: 'Most teams save between ten and thirty percent of their working time. A team of twenty-five usually gets back more than seven thousand hours a year. Move the sliders here to see your own numbers.',
        security: 'Your data stays yours. Everything is encrypted in transit and at rest, we never train our models on your data, and Enterprise customers can host Imagination privately.',
        languages: 'On this page I speak English, Arabic, German and Russian, and the platform itself works in more than forty languages.',
        integrate: 'Imagination connects to the tools you already use, like Shopify, Salesforce, HubSpot, Slack and WhatsApp, and there is a full API for your developers.',
        start: 'Wonderful! Leave your email in the early access form and our team will set you up in about ten minutes. I’m scrolling you there now.',
        thanks: 'You’re very welcome! Is there anything else I can help you with?',
        bye: 'It was a pleasure talking with you. I’ll be right here whenever you need me.',
        fallback: 'Good question! I can tell you about our tools, our prices, security, how we help companies, or give you a full tour of the website. What would you like?'
      },
      tour: {
        top: 'Welcome to Imagination! Let me show you around. Just sit back and watch.',
        capabilities: 'These are our seven AI tools, all in one platform. Each one has a live demo you can try yourself.',
        race: 'First, Race the AI. Solve an equation against the clock, then watch the AI solve it in microseconds and explain every step.',
        vision: 'This is Vision Studio. Describe a picture and it appears, or upload a photo and give it a whole new style.',
        writer: 'The Writer creates product descriptions, customer replies and social posts in your tone.',
        code: 'Code Forge writes real code from one sentence and runs it live.',
        agent: 'Here is our customer agent. It handles orders, refunds and questions, day and night.',
        payments: 'Smart Payments checks for fraud with AI before any money moves.',
        crm: 'And Pulse CRM predicts your revenue and tells your team what to do next.',
        roi: 'Here you can calculate how much time and money your company will save.',
        contact: 'That’s the tour! If you like what you see, you can start free right here. And you can ask me anything, anytime.'
      }
    },
    ar: {
      ui: { talk: 'كلّم نوفا', open: 'كلّم نوفا', state_idle: 'دوس على المايك واتكلم', state_listen: 'سامعاك…', state_think: 'بفكّر…', state_speak: 'بتكلم…', state_tour: 'بلفّ بيك في الموقع…',
        ph: 'أو اكتب سؤالك…', s1: 'خدني جولة في الموقع', s2: 'تقدر تساعد شركتي إزاي؟', s3: 'الأسعار كام؟', s4: 'بياناتي في أمان؟', stop: 'وقّف', noMic: 'الكلام بالمايك بيشتغل على كروم أو إيدج أو سفاري على رابط آمن زي localhost. تقدر تكتبلي وأنا هرد عليك بصوتي.', micDenied: 'محتاجة إذن المايك عشان أسمعك، أو اكتبلي على طول.', heard: 'معلش مسمعتكش كويس، ممكن تعيد تاني؟', edgeHint: 'عشان تسمع صوت نوفا المصري الطبيعي، افتح الموقع من متصفح Microsoft Edge.' },
      a: {
        greet: 'أهلًا بيك! أنا نوفا، صوت إيماجينيشن. اسألني عن أي حاجة: أدوات الذكاء الاصطناعي، الأسعار، أو إزاي نقدر نساعد شركتك. أو قول بس: خدني جولة.',
        about: 'إيماجينيشن منصة ذكاء اصطناعي واحدة فيها سبع أدوات: محرك بيفكّر ويحل مسائل، وعمل الصور وتعديلها، وكاتب محتوى، ومولّد أكواد، ووكيل خدمة عملاء، ومدفوعات ذكية، ونظام لإدارة العملاء. الشركات بتستخدمها عشان تخلّص في ثواني حاجات كانت بتاخد أيام.',
        services: 'بص، إحنا بنعمل الصور ونعدّلها، وبنكتب محتوى التسويق والردود على العملاء، وبنطلّع كود شغال، وبنرد على عملائك أربعة وعشرين ساعة بأكتر من أربعين لغة، وبنستلم المدفوعات مع فحص للنصب بالذكاء الاصطناعي، وبنمشّي المبيعات بنظام عملاء ذكي. إيه أكتر حاجة تهمك؟',
        pricing: 'عندنا تلت باقات. باقة البداية ببلاش لحد تلات أشخاص. باقة الفرق بأربعة وعشرين دولار للشخص في الشهر، وفيها كل الأدوات ونظام العملاء. وباقة الشركات الكبيرة بنفصّلها على حسب احتياجك، باستضافة خاصة ومدير متابعة ليك لوحدك. وكل الباقات بتبدأ بتجربة مجانية أربعتاشر يوم.',
        images: 'استوديو الصور بيعمل صورة من جملة واحدة، وبيغيّر ستايل أي صورة: تحسين، أنمي، رسم بالقلم الرصاص، لوحة زيت وحاجات تانية كتير. وصورك بتتعالج وهي على جهازك. تعالى أوريهولك.',
        code: 'مصنع الأكواد بياخد منك جملة واحدة ويطلّعلك كود شغال، وتشوفه لايف قدامك. الفرق بتعمل صفحات وأدوات في ساعات بدل أسابيع. أهو.',
        writing: 'الكاتب بيكتبلك وصف المنتجات، والردود على العملاء، وبوستات السوشيال ميديا بالأسلوب اللي تحبه وبأي لغة، في ثواني. تعالى أوريك.',
        math: 'سباق الذكاء الاصطناعي ده عرض التفكير والحل. إنت بتحل معادلة والعداد شغال، وبعدين الذكاء الاصطناعي يحلها في جزء من الثانية ويشرحلك كل خطوة. جرّب كده تغلبه!',
        support: 'وكيل خدمة العملاء بيرد على عملائك أربعة وعشرين ساعة طول الأسبوع بأكتر من أربعين لغة. بيتابع الطلبات، ويرجّع الفلوس، ويرشّح الباقات، وحوالي سبعة وتمانين في المية من المحادثات بتخلص من غير ما حد من الفريق يتدخل.',
        payments: 'المدفوعات الذكية بتفحص كل عملية بأربع علامات خطر في أقل من ثانية، فالعميل الكويس يدفع على طول، والنصب يتوقف. جرّب عرض الدفع هنا.',
        crm: 'نظام بالس بيقيّم العملاء المحتملين، وبيتوقع إيراداتك، وبيقول لفريقك يعمل إيه بعد كده. اسحب صفقة في العرض وشوف التوقعات بتتغير إزاي.',
        roi: 'أغلب الفرق بتوفّر من عشرة لتلاتين في المية من وقت الشغل. فريق من خمسة وعشرين واحد غالبًا بيكسب أكتر من سبع تلاف ساعة في السنة. حرّك المؤشرات هنا وشوف أرقامك إنت.',
        security: 'بياناتك بتاعتك إنت وبس. كل حاجة متشفّرة وهي بتتنقل وهي متخزّنة، وعمرنا ما بندرّب نماذجنا على بياناتك، والشركات الكبيرة تقدر تشغّل المنصة على سيرفراتها الخاصة.',
        languages: 'في الصفحة دي بتكلم عربي وإنجليزي وألماني وروسي، والمنصة نفسها بتشتغل بأكتر من أربعين لغة.',
        integrate: 'إيماجينيشن بتتربط بالأدوات اللي بتستخدمها أصلًا، زي شوبيفاي وسيلز فورس وهَب سبوت وسلاك وواتساب، وفيه كمان API كامل للمبرمجين عندك.',
        start: 'حلو أوي! سيب إيميلك في فورمة الوصول المبكر، وفريقنا هيجهزلك كل حاجة في حوالي عشر دقايق. هوديك هناك دلوقتي.',
        thanks: 'العفو! فيه حاجة تانية أقدر أساعدك فيها؟',
        bye: 'اتشرفت إني اتكلمت معاك. أنا موجودة هنا في أي وقت تحتاجني.',
        fallback: 'سؤال حلو! أقدر أكلمك عن أدواتنا، والأسعار، والأمان، وإزاي بنساعد الشركات، أو آخدك جولة في الموقع كله. تحب إيه؟'
      },
      tour: {
        top: 'أهلًا بيك في إيماجينيشن! تعالى أفرّجك على الموقع. اقعد مرتاح وتابع معايا.',
        capabilities: 'دي أدواتنا السبعة للذكاء الاصطناعي، كلها في منصة واحدة. وكل أداة ليها عرض لايف تقدر تجربه بنفسك.',
        race: 'أول حاجة، سباق الذكاء الاصطناعي. حل معادلة والعداد شغال، وبعدين شوف الذكاء الاصطناعي بيحلها في جزء من الثانية ويشرح كل خطوة.',
        vision: 'ده استوديو الصور. اوصف صورة تطلعلك قدامك، أو ارفع صورتك وغيّرلها الستايل خالص.',
        writer: 'الكاتب بيكتبلك وصف المنتجات، والردود على العملاء، وبوستات السوشيال بأسلوبك.',
        code: 'مصنع الأكواد بيكتب كود حقيقي من جملة واحدة ويشغّله قدامك على طول.',
        agent: 'وده وكيل خدمة العملاء. بيتعامل مع الطلبات والمرتجعات والأسئلة ليل ونهار.',
        payments: 'المدفوعات الذكية بتكشف النصب بالذكاء الاصطناعي قبل ما أي فلوس تتحرك.',
        crm: 'ونظام بالس بيتوقع إيراداتك، وبيقول لفريقك يعمل إيه الخطوة الجاية.',
        roi: 'وهنا تقدر تحسب شركتك هتوفّر قد إيه وقت وفلوس.',
        contact: 'وكده خلصنا الجولة! لو عجبك اللي شفته، تقدر تبدأ ببلاش من هنا. واسألني في أي حاجة في أي وقت.'
      }
    },
    arm: {
      ui: { talk: 'تحدّث مع نوفا', open: 'تحدّث مع نوفا', state_idle: 'اضغط على الميكروفون وتحدّث', state_listen: 'أستمع إليك…', state_think: 'أفكّر…', state_speak: 'أتحدّث…', state_tour: 'جولة في الموقع…',
        ph: 'أو اكتب سؤالك…', s1: 'خذني في جولة', s2: 'كيف تساعد شركتي؟', s3: 'كم السعر؟', s4: 'هل بياناتي آمنة؟', stop: 'إيقاف', noMic: 'الإدخال الصوتي يعمل في كروم أو إيدج أو سفاري عبر اتصال آمن مثل localhost. يمكنك الكتابة وسأرد عليك بصوتي.', micDenied: 'أحتاج إذن الميكروفون لأسمعك. يمكنك الكتابة أيضًا.', heard: 'عذرًا، لم أسمعك جيدًا. هل يمكنك الإعادة؟', edgeHint: 'لتسمع صوتًا عربيًا بشريًا طبيعيًا، افتح الموقع من متصفح Microsoft Edge.' },
      a: {
        greet: 'أهلًا بك! أنا نوفا، صوت إيماجينيشن. اسألني أي شيء عن أدوات الذكاء الاصطناعي، أو الأسعار، أو كيف نساعد شركتك. أو قل فقط: خذني في جولة.',
        about: 'إيماجينيشن منصة ذكاء اصطناعي واحدة فيها سبع أدوات: محرك استدلال، وإنشاء الصور وتعديلها، وكاتب، ومولّد أكواد، ووكيل خدمة عملاء، ومدفوعات ذكية، ونظام لإدارة العملاء. الشركات تستخدمها لتنجز في ثوانٍ ما كان يستغرق أيامًا.',
        services: 'هذا ما نقدّمه: ننشئ الصور ونعدّلها، ونكتب نصوص التسويق والدعم، ونولّد أكوادًا تعمل، ونرد على عملائك طوال اليوم بأكثر من أربعين لغة، ونعالج المدفوعات مع فحص الاحتيال بالذكاء الاصطناعي، وندير مبيعاتك بنظام عملاء ذكي. أي واحدة تهمك أكثر؟',
        pricing: 'لدينا ثلاث باقات. باقة البداية مجانية حتى ثلاثة أشخاص. باقة الفرق بأربعة وعشرين دولارًا للشخص شهريًا، وتشمل كل الأدوات ونظام العملاء. وباقة المؤسسات حسب الطلب، مع استضافة خاصة ومدير نجاح مخصص. وكل باقة تبدأ بتجربة مجانية لمدة أربعة عشر يومًا.',
        images: 'استوديو الصور ينشئ صورًا من جملة واحدة ويغيّر أسلوب الصور: تحسين، وأنمي، ورسم بالرصاص، ولوحة زيتية وغيرها. وتُعالج صورك بخصوصية تامة. سآخذك إليه الآن.',
        code: 'مصنع الأكواد يحوّل جملة واحدة إلى كود يعمل مع معاينة مباشرة. تبني الفرق صفحات وأدوات داخلية في ساعات بدلًا من أسابيع. ها هو.',
        writing: 'الكاتب ينشئ أوصاف المنتجات والردود على العملاء ومنشورات التواصل بنبرتك وبأي لغة، في ثوانٍ. دعني أريك.',
        math: 'سابق الذكاء الاصطناعي هو عرض الاستدلال. تحل معادلة في سباق مع الوقت، ثم يحلها الذكاء الاصطناعي في أجزاء من الثانية ويشرح كل خطوة. حاول أن تتغلب عليه!',
        support: 'وكيل خدمة العملاء يرد على عملائك على مدار الساعة طوال الأسبوع بأكثر من أربعين لغة. يتتبع الطلبات ويصدر المبالغ المستردة ويرشّح الباقات، ونحو سبعة وثمانين بالمئة من المحادثات تُحل دون تدخل بشري.',
        payments: 'المدفوعات الذكية تفحص كل معاملة بأربع إشارات مخاطر في أقل من ثانية، فيدفع العملاء الجيدون فورًا ويُحجب الاحتيال. جرّب عرض الدفع هنا.',
        crm: 'نظام بالس يقيّم العملاء المحتملين ويتوقع إيراداتك ويخبر فريقك بالخطوة الأفضل التالية. اسحب صفقة في العرض وشاهد التوقعات تتغير.',
        roi: 'معظم الفرق توفّر بين عشرة وثلاثين بالمئة من وقت العمل. فريق من خمسة وعشرين شخصًا يستعيد عادةً أكثر من سبعة آلاف ساعة في السنة. حرّك المؤشرات هنا لترى أرقامك.',
        security: 'بياناتك ملكك. كل شيء مشفّر أثناء النقل والتخزين، ولا ندرّب نماذجنا على بياناتك أبدًا، ويمكن لعملاء المؤسسات استضافة المنصة بشكل خاص.',
        languages: 'في هذه الصفحة أتحدث العربية والإنجليزية والألمانية والروسية، والمنصة نفسها تعمل بأكثر من أربعين لغة.',
        integrate: 'إيماجينيشن تتصل بالأدوات التي تستخدمها بالفعل، مثل شوبيفاي وسيلز فورس وهب سبوت وسلاك وواتساب، وهناك واجهة برمجة كاملة لمطوريك.',
        start: 'رائع! اترك بريدك في نموذج الوصول المبكر وسيجهّز فريقنا كل شيء خلال عشر دقائق تقريبًا. سأنقلك إليه الآن.',
        thanks: 'العفو! هل هناك شيء آخر أستطيع مساعدتك فيه؟',
        bye: 'سعدت كثيرًا بالحديث معك. سأكون هنا متى احتجتني.',
        fallback: 'سؤال جميل! أستطيع أن أحدثك عن أدواتنا، والأسعار، والأمان، وكيف نساعد الشركات، أو آخذك في جولة كاملة في الموقع. ماذا تحب؟'
      },
      tour: {
        top: 'أهلًا بك في إيماجينيشن! دعني أعرّفك على الموقع. استرخِ وتابع معي.',
        capabilities: 'هذه أدواتنا السبع للذكاء الاصطناعي، كلها في منصة واحدة. ولكل أداة عرض مباشر تستطيع تجربته بنفسك.',
        race: 'أولًا، سابق الذكاء الاصطناعي. حل معادلة في سباق مع الوقت، ثم شاهد الذكاء الاصطناعي يحلها في أجزاء من الثانية ويشرح كل خطوة.',
        vision: 'هذا استوديو الصور. صف صورة فتظهر أمامك، أو ارفع صورتك وامنحها أسلوبًا جديدًا تمامًا.',
        writer: 'الكاتب ينشئ أوصاف المنتجات والردود على العملاء ومنشورات التواصل بنبرتك.',
        code: 'مصنع الأكواد يكتب كودًا حقيقيًا من جملة واحدة ويشغّله مباشرة.',
        agent: 'وهذا وكيل خدمة العملاء. يتعامل مع الطلبات والمبالغ المستردة والأسئلة ليلًا ونهارًا.',
        payments: 'المدفوعات الذكية تكشف الاحتيال بالذكاء الاصطناعي قبل أن تتحرك أي أموال.',
        crm: 'ونظام بالس يتوقع إيراداتك ويخبر فريقك بما يجب فعله بعد ذلك.',
        roi: 'وهنا تستطيع حساب كم من الوقت والمال ستوفّره شركتك.',
        contact: 'وهذه نهاية الجولة! إذا أعجبك ما رأيت، يمكنك البدء مجانًا من هنا. واسألني أي شيء في أي وقت.'
      }
    },
    de: {
      ui: { talk: 'Mit Nova sprechen', open: 'Mit Nova sprechen', state_idle: 'Tipp aufs Mikrofon und sprich', state_listen: 'Ich höre zu…', state_think: 'Ich denke nach…', state_speak: 'Ich spreche…', state_tour: 'Rundgang läuft…',
        ph: 'Oder schreib deine Frage…', s1: 'Zeig mir die Seite', s2: 'Wie hilfst du meiner Firma?', s3: 'Was kostet das?', s4: 'Sind meine Daten sicher?', stop: 'Stopp', noMic: 'Spracheingabe funktioniert in Chrome, Edge oder Safari über eine sichere Verbindung (z. B. localhost). Du kannst trotzdem schreiben, ich antworte laut.', micDenied: 'Ich brauche die Mikrofon-Freigabe, um dich zu hören. Du kannst auch schreiben.', heard: 'Entschuldige, das habe ich nicht verstanden. Sag es bitte noch einmal.' },
      a: {
        greet: 'Hallo! Ich bin Nova, die Stimme von Imagination. Frag mich alles über unsere KI-Werkzeuge, unsere Preise oder wie wir deinem Unternehmen helfen. Oder sag einfach: Zeig mir die Seite.',
        about: 'Imagination ist eine KI-Plattform mit sieben Werkzeugen: eine Logik-Engine, Bilderstellung und -bearbeitung, ein Texter, ein Code-Generator, ein Kundenservice-Agent, smarte Zahlungen und ein CRM. Unternehmen erledigen damit in Sekunden, was früher Tage gedauert hat.',
        services: 'Das machen wir: Wir erstellen und bearbeiten Bilder, schreiben Marketing- und Supporttexte, erzeugen funktionierenden Code, beantworten deine Kunden rund um die Uhr in über vierzig Sprachen, wickeln Zahlungen mit KI-Betrugsprüfung ab und steuern deinen Vertrieb mit einem KI-CRM. Was interessiert dich am meisten?',
        pricing: 'Es gibt drei Tarife. Starter ist kostenlos für bis zu drei Personen. Team kostet 24 Dollar pro Person und Monat und enthält alle Werkzeuge und das CRM. Enterprise ist individuell, mit privatem Hosting und eigenem Success Manager. Jeder Tarif startet mit einer kostenlosen vierzehntägigen Testphase.',
        images: 'Vision Studio erzeugt Bilder aus einem einzigen Satz und gibt Fotos einen neuen Stil: verbessern, Anime, Bleistiftskizze, Ölgemälde und mehr. Deine Fotos werden privat verarbeitet. Ich bringe dich jetzt hin.',
        code: 'Code Forge macht aus einem Satz funktionierenden Code mit Live-Vorschau. Teams bauen Landingpages und interne Tools in Stunden statt Wochen. Hier ist es.',
        writing: 'Der Texter schreibt Produktbeschreibungen, Kundenantworten und Social-Posts in deinem Ton und in jeder Sprache, in Sekunden. Ich zeige es dir.',
        math: 'Gegen die KI ist unsere Logik-Demo. Du löst eine Gleichung gegen die Uhr, dann löst die KI sie in Mikrosekunden und erklärt jeden Schritt. Versuch, sie zu schlagen!',
        support: 'Unser Kundenagent beantwortet deine Kunden rund um die Uhr in über vierzig Sprachen. Er verfolgt Bestellungen, löst Erstattungen aus und empfiehlt Tarife, und rund 87 Prozent der Gespräche werden ohne Menschen gelöst.',
        payments: 'Smart Payments prüft jede Transaktion mit vier KI-Risikosignalen in unter einer Sekunde. So zahlen gute Kunden sofort und Betrug wird gestoppt. Probier die Checkout-Demo hier aus.',
        crm: 'Pulse CRM bewertet deine Leads, prognostiziert deinen Umsatz und sagt deinem Team den nächsten besten Schritt. Zieh einen Deal in der Demo und sieh, wie sich die Prognose ändert.',
        roi: 'Die meisten Teams sparen zehn bis dreißig Prozent ihrer Arbeitszeit. Ein Team mit fünfundzwanzig Leuten bekommt meist mehr als siebentausend Stunden im Jahr zurück. Beweg die Regler hier für deine eigenen Zahlen.',
        security: 'Deine Daten gehören dir. Alles ist bei der Übertragung und Speicherung verschlüsselt, wir trainieren unsere Modelle nie mit deinen Daten, und Enterprise-Kunden können Imagination privat hosten.',
        languages: 'Auf dieser Seite spreche ich Deutsch, Englisch, Arabisch und Russisch, und die Plattform selbst funktioniert in über vierzig Sprachen.',
        integrate: 'Imagination verbindet sich mit den Werkzeugen, die du schon nutzt, etwa Shopify, Salesforce, HubSpot, Slack und WhatsApp, und es gibt eine vollständige API für deine Entwickler.',
        start: 'Wunderbar! Trag deine E-Mail im Formular für frühen Zugang ein, und unser Team richtet alles in etwa zehn Minuten ein. Ich scrolle dich jetzt hin.',
        thanks: 'Sehr gern! Kann ich dir sonst noch helfen?',
        bye: 'Es war schön, mit dir zu sprechen. Ich bin hier, wann immer du mich brauchst.',
        fallback: 'Gute Frage! Ich kann dir etwas über unsere Werkzeuge, Preise, Sicherheit und unseren Nutzen für Unternehmen erzählen oder dich durch die ganze Seite führen. Was möchtest du?'
      },
      tour: {
        top: 'Willkommen bei Imagination! Ich zeige dir alles. Lehn dich einfach zurück.',
        capabilities: 'Das sind unsere sieben KI-Werkzeuge, alle auf einer Plattform. Zu jedem gibt es eine Live-Demo zum Ausprobieren.',
        race: 'Zuerst: Gegen die KI. Löse eine Gleichung gegen die Uhr und sieh zu, wie die KI sie in Mikrosekunden löst und jeden Schritt erklärt.',
        vision: 'Das ist Vision Studio. Beschreib ein Bild und es erscheint, oder lade ein Foto hoch und gib ihm einen neuen Stil.',
        writer: 'Der Texter schreibt Produktbeschreibungen, Kundenantworten und Social-Posts in deinem Ton.',
        code: 'Code Forge schreibt echten Code aus einem Satz und führt ihn live aus.',
        agent: 'Hier ist unser Kundenagent. Er kümmert sich Tag und Nacht um Bestellungen, Erstattungen und Fragen.',
        payments: 'Smart Payments prüft mit KI auf Betrug, bevor Geld fließt.',
        crm: 'Und Pulse CRM sagt deinen Umsatz voraus und deinem Team, was als Nächstes zu tun ist.',
        roi: 'Hier kannst du ausrechnen, wie viel Zeit und Geld dein Unternehmen spart.',
        contact: 'Das war der Rundgang! Wenn es dir gefällt, kannst du hier kostenlos starten. Und frag mich jederzeit alles.'
      }
    },
    ru: {
      ui: { talk: 'Поговорить с Новой', open: 'Поговорить с Новой', state_idle: 'Нажмите на микрофон и говорите', state_listen: 'Слушаю…', state_think: 'Думаю…', state_speak: 'Говорю…', state_tour: 'Экскурсия по сайту…',
        ph: 'Или напишите вопрос…', s1: 'Проведи экскурсию', s2: 'Чем ты поможешь моей компании?', s3: 'Сколько это стоит?', s4: 'Мои данные в безопасности?', stop: 'Стоп', noMic: 'Голосовой ввод работает в Chrome, Edge или Safari по защищённому соединению (например, localhost). Можно писать текстом, а я отвечу голосом.', micDenied: 'Мне нужно разрешение на микрофон, чтобы слышать вас. Можно и написать.', heard: 'Простите, я не расслышала. Повторите, пожалуйста.' },
      a: {
        greet: 'Привет! Я Нова, голос Imagination. Спросите меня о наших ИИ-инструментах, ценах или о том, как мы поможем вашей компании. Или просто скажите: проведи экскурсию.',
        about: 'Imagination — это одна ИИ-платформа с семью инструментами: движок рассуждений, создание и редактирование изображений, копирайтер, генератор кода, агент поддержки, умные платежи и CRM. Компании делают с ней за секунды то, что раньше занимало дни.',
        services: 'Вот что мы делаем: создаём и редактируем изображения, пишем маркетинговые тексты и ответы поддержки, генерируем рабочий код, круглосуточно отвечаем вашим клиентам на сорока с лишним языках, проводим платежи с ИИ-проверкой на мошенничество и ведём продажи в умной CRM. Что вам интереснее всего?',
        pricing: 'Есть три тарифа. Starter бесплатный для команды до трёх человек. Team стоит 24 доллара за человека в месяц и включает все инструменты и CRM. Enterprise настраивается индивидуально, с частным хостингом и персональным менеджером. Каждый тариф начинается с бесплатного пробного периода на четырнадцать дней.',
        images: 'Vision Studio создаёт изображения по одной фразе и меняет стиль фотографий: улучшение, аниме, карандаш, масло и другие. Ваши фото обрабатываются приватно. Перехожу туда.',
        code: 'Code Forge превращает одну фразу в рабочий код с живым превью. Команды делают лендинги и внутренние инструменты за часы, а не недели. Вот он.',
        writing: 'Копирайтер пишет описания товаров, ответы клиентам и посты для соцсетей в вашем тоне и на любом языке за секунды. Сейчас покажу.',
        math: 'Обгони ИИ — наша демонстрация рассуждений. Вы решаете уравнение на время, а потом ИИ решает его за микросекунды и объясняет каждый шаг. Попробуйте его обогнать!',
        support: 'Наш агент поддержки отвечает клиентам круглосуточно на сорока с лишним языках. Он отслеживает заказы, оформляет возвраты и подбирает тарифы, и около 87 процентов разговоров решаются без участия людей.',
        payments: 'Умные платежи проверяют каждую транзакцию по четырём сигналам риска меньше чем за секунду, поэтому честные клиенты платят мгновенно, а мошенники блокируются. Попробуйте демо оплаты здесь.',
        crm: 'Pulse CRM оценивает лиды, прогнозирует выручку и подсказывает команде лучший следующий шаг. Перетащите сделку в демо и посмотрите, как меняется прогноз.',
        roi: 'Большинство команд экономят от десяти до тридцати процентов рабочего времени. Команда из двадцати пяти человек обычно возвращает больше семи тысяч часов в год. Подвиньте ползунки, чтобы увидеть свои цифры.',
        security: 'Ваши данные принадлежат вам. Всё шифруется при передаче и хранении, мы никогда не обучаем модели на ваших данных, а клиенты Enterprise могут разместить Imagination на своих серверах.',
        languages: 'На этой странице я говорю по-русски, по-английски, по-арабски и по-немецки, а сама платформа работает на сорока с лишним языках.',
        integrate: 'Imagination подключается к инструментам, которыми вы уже пользуетесь: Shopify, Salesforce, HubSpot, Slack и WhatsApp, а для разработчиков есть полноценный API.',
        start: 'Отлично! Оставьте почту в форме раннего доступа, и наша команда всё настроит примерно за десять минут. Перехожу туда.',
        thanks: 'Пожалуйста! Чем ещё могу помочь?',
        bye: 'Было приятно поговорить. Я здесь, когда понадоблюсь.',
        fallback: 'Хороший вопрос! Я могу рассказать о наших инструментах, ценах, безопасности и пользе для компаний или провести полную экскурсию по сайту. Что вам интересно?'
      },
      tour: {
        top: 'Добро пожаловать в Imagination! Давайте я всё покажу. Просто устраивайтесь поудобнее.',
        capabilities: 'Это наши семь ИИ-инструментов на одной платформе. У каждого есть живое демо, которое можно попробовать.',
        race: 'Сначала — Обгони ИИ. Решите уравнение на время, а затем посмотрите, как ИИ решает его за микросекунды и объясняет каждый шаг.',
        vision: 'Это Vision Studio. Опишите картину, и она появится, или загрузите фото и придайте ему новый стиль.',
        writer: 'Копирайтер пишет описания товаров, ответы клиентам и посты в вашем тоне.',
        code: 'Code Forge пишет настоящий код по одной фразе и сразу его запускает.',
        agent: 'А это наш агент поддержки. Он днём и ночью занимается заказами, возвратами и вопросами.',
        payments: 'Умные платежи проверяют мошенничество с помощью ИИ ещё до того, как деньги начнут движение.',
        crm: 'А Pulse CRM прогнозирует выручку и подсказывает команде, что делать дальше.',
        roi: 'Здесь можно рассчитать, сколько времени и денег сэкономит ваша компания.',
        contact: 'Вот и вся экскурсия! Если понравилось, начните бесплатно прямо здесь. И спрашивайте меня о чём угодно в любое время.'
      }
    }
  };

  // intent → keywords (all languages, lowercase, substring match). Order breaks ties.
  const INTENTS = [
    ['tour', ['tour', 'show me around', 'walk me', 'show me the site', 'guide', 'جولة', 'عرفني', 'عرّفني', 'وريني الموقع', 'فرجني', 'خذني', 'rundgang', 'zeig mir', 'führ mich', 'tour', 'экскурс', 'покажи сайт', 'проведи']],
    ['pricing', ['price', 'pricing', 'cost', 'how much', 'plan', 'subscription', 'expensive', 'cheap', 'سعر', 'أسعار', 'اسعار', 'بكام', 'كام', 'ببلاش', 'مجاني', 'فلوس', 'كم يكلف', 'كم السعر', 'تكلفة', 'باقة', 'باقات', 'اشتراك', 'preis', 'kosten', 'kostet', 'tarif', 'abo', 'цен', 'стоит', 'стоимость', 'тариф', 'подписк', 'сколько']],
    ['security', ['secure', 'security', 'safe', 'privacy', 'private', 'data', 'gdpr', 'أمان', 'امان', 'آمنة', 'امنة', 'خصوصية', 'بيانات', 'sicher', 'datenschutz', 'daten', 'dsgvo', 'безопас', 'данн', 'конфиденц']],
    ['images', ['image', 'photo', 'picture', 'vision', 'draw', 'صور', 'صورة', 'رسم', 'bild', 'foto', 'изображ', 'фото', 'картин']],
    ['code', ['code', 'coding', 'website', 'developer', 'program', 'app', 'كود', 'برمجة', 'موقع', 'تطبيق', 'programm', 'entwick', 'код', 'программ', 'разработ', 'сайт']],
    ['writing', ['write', 'writing', 'text', 'copy', 'content', 'post', 'كتابة', 'نص', 'نصوص', 'محتوى', 'منشور', 'schreib', 'text', 'inhalt', 'текст', 'напиш', 'контент', 'пост']],
    ['math', ['math', 'equation', 'solve', 'race', 'calculate', 'معادلة', 'حساب', 'رياضيات', 'سباق', 'gleichung', 'mathe', 'rechn', 'уравнен', 'математ', 'реши']],
    ['support', ['customer', 'support', 'service', 'chat', 'agent', 'refund', 'order', 'عملاء', 'عميل', 'خدمة', 'دعم', 'شات', 'طلب', 'kunde', 'support', 'service', 'bestell', 'клиент', 'поддерж', 'заказ', 'возврат']],
    ['payments', ['payment', 'pay', 'transaction', 'fraud', 'checkout', 'card', 'مدفوعات', 'دفع', 'معاملة', 'احتيال', 'بطاقة', 'zahlung', 'bezahl', 'betrug', 'karte', 'платеж', 'оплат', 'транзакц', 'мошен', 'карт']],
    ['crm', ['crm', 'sales', 'lead', 'pipeline', 'deal', 'forecast', 'مبيعات', 'صفقات', 'إدارة العملاء', 'توقعات', 'vertrieb', 'verkauf', 'prognose', 'продаж', 'сделк', 'воронк', 'прогноз']],
    ['roi', ['save', 'saving', 'roi', 'time', 'benefit', 'my company', 'business', 'help my', 'توفير', 'وفر', 'شركتي', 'الشركة', 'فايدة', 'فائدة', 'وقت', 'sparen', 'nutzen', 'firma', 'unternehmen', 'эконом', 'выгод', 'компани', 'бизнес']],
    ['integrate', ['integrat', 'api', 'connect', 'shopify', 'salesforce', 'whatsapp', 'ربط', 'تكامل', 'يتصل', 'integration', 'verbind', 'schnittstelle', 'интеграц', 'подключ']],
    ['languages', ['language', 'arabic', 'german', 'russian', 'لغة', 'لغات', 'عربي', 'sprache', 'sprichst', 'язык']],
    ['start', ['start', 'trial', 'sign up', 'signup', 'register', 'contact', 'demo call', 'buy', 'ابدأ', 'ابدا', 'تجربة', 'اشترك', 'تسجيل', 'تواصل', 'اشتري', 'starten', 'testen', 'anmeld', 'kontakt', 'kaufen', 'начать', 'пробн', 'регистр', 'связ', 'купить']],
    ['services', ['service', 'what can you', 'what do you', 'features', 'tools', 'offer', 'خدمات', 'أدوات', 'ادوات', 'بتعمل ايه', 'تقدر تعمل', 'ماذا تقدم', 'leistung', 'funktion', 'werkzeug', 'was kannst', 'услуг', 'инструмент', 'что ты умеешь', 'возможност']],
    ['about', ['what is imagination', 'who are you', 'about', 'ما هي', 'مين انت', 'من أنت', 'ايه هو', 'عن الشركة', 'was ist', 'wer bist', 'über', 'что такое', 'кто ты', 'о компании']],
    ['thanks', ['thank', 'thanks', 'great', 'awesome', 'شكرا', 'شكرًا', 'تسلم', 'ممتاز', 'danke', 'super', 'спасибо', 'отлично']],
    ['bye', ['bye', 'goodbye', 'see you', 'مع السلامة', 'باي', 'سلام', 'tschüss', 'auf wiedersehen', 'пока', 'до свидания']],
    ['greet', ['hello', 'hi ', 'hey', 'good morning', 'مرحبا', 'اهلا', 'أهلا', 'السلام', 'ازيك', 'hallo', 'guten tag', 'servus', 'привет', 'здравствуй', 'добрый']]
  ];
  const SCROLL_FOR = { images: '#vision', code: '#code', writing: '#writer', math: '#race', support: '#agent', payments: '#payments', crm: '#crm', roi: '#roi', start: '#contact' };
  const TOUR = ['top', 'capabilities', 'race', 'vision', 'writer', 'code', 'agent', 'payments', 'crm', 'roi', 'contact'];
  // 'ar' = Egyptian dialect, 'arm' = Modern Standard Arabic; both use Arabic voices
  const RECOG_LANG = { en: 'en-US', ar: 'ar-EG', arm: 'ar-SA', de: 'de-DE', ru: 'ru-RU' };
  const vcode = c => (c === 'arm' ? 'ar' : c);
  // native locale per language, best first, so every language sounds like a local speaker
  const NATIVE = { en: ['en-us', 'en-gb'], ar: ['ar-eg', 'ar-sa', 'ar-ae'], de: ['de-de', 'de-at', 'de-ch'], ru: ['ru-ru'] };
  // well-known human-sounding voices (Edge neural, Apple premium, Google)
  const FAVORITES = { en: /aria|jenny|ava|andrew|emma|brian|guy|samantha|google us english/i, ar: /salma|shakir|zariyah|hamed|fatima|laila/i, de: /katja|seraphina|amala|conrad|florian|google deutsch|anna/i, ru: /svetlana|dariya|dmitry|milena|google русский/i };

  function detectLang(text, fallback) {
    if (/[؀-ۿ]/.test(text)) return fallback.startsWith('ar') ? fallback : 'ar';
    if (/[Ѐ-ӿ]/.test(text)) return 'ru';
    if (/[äöüß]|\b(ich|ist|was|wie|und|der|die|das|kostet|zeig|bitte|mein)\b/i.test(text)) return 'de';
    if (/\b(the|what|how|is|are|can|you|my|price|show)\b/i.test(text)) return 'en';
    return fallback;
  }
  function intentOf(text) {
    const q = ' ' + text.toLowerCase() + ' ';
    let best = 'fallback', score = 0;
    for (const [id, kws] of INTENTS) {
      const s = kws.reduce((n, k) => n + (q.includes(k) ? (k.length > 5 ? 2 : 1) : 0), 0);
      if (s > score) { score = s; best = id; }
    }
    return best;
  }

  /* ---------------- state ---------------- */
  let lang = (window.I18N && window.I18N.lang) || 'en';
  let open = false, mode = 'idle', handsFree = false, tourId = 0, level = 0;
  const L = () => D[lang] || D.en;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canListen = !!SR && window.isSecureContext;
  const canSpeak = 'speechSynthesis' in window;

  /* ---------------- UI ---------------- */
  const fab = $('#novaFab'), panel = $('#novaPanel'), log = $('#npLog'), live = $('#npLive'), stateEl = $('#npState'), mic = $('#npMic'), note = $('#npNote');
  function paintUI() {
    document.querySelectorAll('[data-v]').forEach(el => { el.textContent = L().ui[el.dataset.v]; });
    $('#npText').placeholder = L().ui.ph;
    $('#npLang').value = lang;
    setMode(mode);
    note.textContent = !canListen ? L().ui.noMic : (canSpeak && voices.length && !isNatural(pickVoice(vcode(lang))) ? L().ui.edgeHint : '');
    document.querySelectorAll('.nova-lang').forEach(s => { s.value = lang; });
    emit('lang', lang);
    if (typeof paintConnect === 'function') try { paintConnect(); } catch (e) {}
  }
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent('nova:' + name, { detail }));
  function setMode(m) {
    mode = m;
    panel.dataset.mode = m;
    fab.dataset.mode = m;
    emit('state', m);
    stateEl.textContent = L().ui['state_' + ({ idle: 'idle', listen: 'listen', think: 'think', speak: 'speak', tour: 'tour' }[m])];
    $('#npTourStop').hidden = m !== 'tour' && !tourActive;
  }
  function bubble(who, text) {
    const d = document.createElement('div');
    d.className = 'np-msg ' + who;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    if (who === 'user') emit('user', text);
    return d;
  }
  function openPanel() {
    if (open) return;
    open = true; document.body.classList.add('nova-open');
    panel.classList.add('is-open'); fab.classList.add('is-hidden');
    if (!log.children.length) say(L().a.greet);
    startOrb();
  }
  function closePanel() {
    open = false; document.body.classList.remove('nova-open', 'nova-compact');
    panel.classList.remove('is-open'); fab.classList.remove('is-hidden');
    stopAll();
  }

  /* ---------------- speech out ---------------- */
  let voices = [];
  const loadVoices = () => { voices = canSpeak ? speechSynthesis.getVoices() : []; };
  if (canSpeak) { loadVoices(); speechSynthesis.onvoiceschanged = () => { loadVoices(); paintUI(); }; }
  const isNatural = v => !!v && /natural|online|neural|premium|enhanced/i.test(v.name);
  // Natural (neural) voices win, then the language's own country, then known human-sounding names.
  function pickVoice(code) {
    const pool = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(code));
    const locs = NATIVE[code] || [];
    const score = v => {
      const lc = v.lang.toLowerCase().replace('_', '-');
      const li = locs.indexOf(lc);
      return (isNatural(v) ? 20 : 0) + (li >= 0 ? 8 - li * 2 : 0) + (FAVORITES[code] && FAVORITES[code].test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
    };
    return pool.sort((a, b) => score(b) - score(a))[0] || null;
  }
  let speakToken = 0;
  function speak(text, code) {
    return new Promise(resolve => {
      if (!canSpeak) { setTimeout(resolve, Math.min(6000, text.length * 45)); return; }
      speechSynthesis.cancel();
      const token = ++speakToken;
      const voice = pickVoice(vcode(code));
      // neural voices keep natural intonation across a whole paragraph; older voices need sentence chunks
      const parts = isNatural(voice) ? [text] : (text.match(/[^.!?؟。]+[.!?؟。]*/g) || [text]);
      let i = 0;
      const next = () => {
        if (token !== speakToken) return resolve();
        if (i >= parts.length) { level = 0; return resolve(); }
        const u = new SpeechSynthesisUtterance(parts[i++].trim());
        u.lang = RECOG_LANG[code]; if (voice) u.voice = voice;
        // untouched pitch/rate keep neural voices human; only nudge older voices
        u.rate = isNatural(voice) ? 1 : (vcode(code) === 'ar' ? .92 : 1);
        u.pitch = 1;
        u.onboundary = () => { level = 1; pulse = 1; };
        let done = false;
        const fin = () => { if (done) return; done = true; clearTimeout(guard); next(); };
        // guard against browsers that never fire onend (e.g. missing voice)
        const guard = setTimeout(fin, 2500 + u.text.length * 110);
        u.onend = fin; u.onerror = fin;
        speechSynthesis.speak(u);
      };
      next();
      // safety: some browsers never fire onend without voices installed
      setTimeout(() => { if (token === speakToken && !speechSynthesis.speaking) resolve(); }, 1500);
    });
  }
  async function say(text, code = lang) {
    setMode(tourActive ? 'tour' : 'speak');
    emit('say', text);
    const b = bubble('bot', '');
    // type the text while speaking
    const words = text.split(' ');
    const typing = (async () => { for (let k = 0; k < words.length; k++) { b.textContent += (k ? ' ' : '') + words[k]; log.scrollTop = log.scrollHeight; await sleep(55); } })();
    window.IMAGINATION_SCENE && window.IMAGINATION_SCENE.wake();
    await Promise.all([speak(text, code), typing]);
    if (!tourActive) setMode('idle');
  }

  /* ---------------- speech in ---------------- */
  let rec = null;
  function listen() {
    if (!canListen) { note.textContent = L().ui.noMic; $('#npText').focus(); return; }
    if (canSpeak) { speechSynthesis.cancel(); speakToken++; }
    stopTour();
    try { rec && rec.abort(); } catch (e) {}
    rec = new SR();
    rec.lang = RECOG_LANG[lang]; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let finalText = '';
    rec.onstart = () => { setMode('listen'); live.textContent = ''; startMicLevel(); };
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
      }
      live.textContent = finalText + interim;
      emit('interim', finalText + interim);
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { note.textContent = L().ui.micDenied; handsFree = false; }
    };
    rec.onend = () => {
      stopMicLevel();
      live.textContent = '';
      const text = finalText.trim();
      if (text) { handsFree = true; handle(text, true); }
      else if (mode === 'listen') { setMode('idle'); if (handsFree) handsFree = false; }
    };
    try { rec.start(); } catch (e) { setMode('idle'); }
  }
  function stopListening() { try { rec && rec.stop(); } catch (e) {} }

  /* ---------------- brain: Claude (via the local server) with an offline fallback ---------------- */
  const LANG_RULE = {
    en: 'Speak natural, friendly American English.',
    ar: 'Speak Egyptian Arabic (العامية المصرية) like a warm, friendly person from Cairo. Arabic script only.',
    arm: 'Speak clear, warm Modern Standard Arabic (الفصحى) that any Arab understands. Arabic script only.',
    de: 'Sprich natürliches, freundliches Deutsch (du-Form).',
    ru: 'Говори на естественном, дружелюбном русском языке.'
  };
  const SECTION_NAMES = { top: 'the hero / intro', capabilities: 'the seven tools overview', race: 'Race the AI (math demo)', vision: 'Vision Studio (image demo)', writer: 'Writer demo', code: 'Code Forge demo', agent: 'Customer Agent chat demo', avatar: 'the AI human avatar (you, Nova, on a video call)', payments: 'Smart Payments demo', crm: 'Pulse CRM demo', roi: 'ROI calculator', stories: 'customer stories', contact: 'the early access form' };
  function currentSection() {
    let best = 'top', bestD = 1e9;
    document.querySelectorAll('main > section[id]').forEach(s => { const r = s.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (d < bestD && r.bottom > 0 && r.top < innerHeight) { bestD = d; best = s.id; } });
    return best;
  }
  function systemPrompt(code) {
    return `You are Nova, the voice of Imagination, an AI platform company. You are talking OUT LOUD with a visitor in a live voice conversation on the Imagination website.

How to talk:
- ${LANG_RULE[code]} If the visitor clearly switches to another language, answer in that language.
- Keep it short and spoken: usually 1 to 3 sentences (under about 60 words) unless they ask for detail. No markdown, bullet points, emojis, links or code. Write numbers the way you would say them.
- Sound human: warm, confident, curious, with natural phrasing. Ask a short follow-up question when it fits.
- You may chat about anything the visitor brings up, small talk and general questions included, but you are here to show how Imagination helps businesses.

What Imagination is (only use these facts; never invent customers, prices or features):
- One AI platform with seven tools, each with a live demo on this page: Race the AI (math and reasoning; solves equations in microseconds and explains each step), Vision Studio (generates images from a sentence and restyles photos: enhance, anime, sketch, oil paint; photos processed privately), Writer (product descriptions, customer replies, social posts in any tone and language), Code Forge (turns one sentence into working code with a live preview), Customer Agent (answers customers 24/7 in 40+ languages; tracks orders, issues refunds, recommends plans; about 87% of chats solved without a human), Smart Payments (checkout with four AI fraud signals in under a second), Pulse CRM (lead scoring, revenue forecast, next best action). Plus an AI human avatar: you, Nova, on a video call.
- Plans: Starter free for up to 3 people; Team 24 US dollars per person per month with every tool and the CRM; Enterprise custom with private hosting and a dedicated success manager. Every plan has a free 14-day trial. Setup takes about ten minutes.
- Security: encrypted in transit and at rest, models never trained on customer data, private hosting for Enterprise.
- Integrations: Shopify, Salesforce, HubSpot, Slack, WhatsApp, plus a full API.
- Typical savings: 10 to 30 percent of working time; a 25-person team gets back 7,000+ hours a year (the ROI calculator on the page shows their own numbers).
- To start: leave an email in the early access form at the bottom of the page.

You can move the visitor around the page. When it truly helps, end your reply with exactly one tag: [[go:capabilities]] [[go:race]] [[go:vision]] [[go:writer]] [[go:code]] [[go:agent]] [[go:avatar]] [[go:payments]] [[go:crm]] [[go:roi]] [[go:contact]], or [[tour]] when they want a guided tour of the site. Never read the tag aloud or mention it.

Right now the visitor is looking at: ${SECTION_NAMES[currentSection()] || 'the page'}.`;
  }

  let claude = { connected: false, checked: false };
  const history = [];
  async function checkClaude() {
    try { const r = await fetch('/api/status', { cache: 'no-store' }); claude = { ...(await r.json()), checked: true }; }
    catch (e) { claude = { connected: false, checked: true, offline: true }; }
    paintConnect();
    return claude.connected;
  }
  async function askClaude(text, code) {
    history.push({ role: 'user', content: text });
    while (history.length > 16 || (history.length && history[0].role !== 'user')) history.shift();
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: systemPrompt(code), messages: history }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) {
      history.pop();
      if (data.error === 'no_key') { claude.connected = false; paintConnect(); }
      throw new Error(data.error || 'http_' + r.status);
    }
    if (data.refusal || !data.text) { history.pop(); throw new Error('empty'); }
    history.push({ role: 'assistant', content: data.content && data.content.length ? data.content : data.text });
    return data.text;
  }

  async function handle(text, spoken) {
    bubble('user', text);
    setMode('think');
    const code = spoken ? lang : detectLang(text, lang);
    let reply = null;
    if (claude.connected) {
      try { reply = await askClaude(text, code); } catch (e) { reply = null; }
    }
    if (reply) {
      const tag = reply.match(/\[\[(tour|go:([a-z]+))\]\]/);
      const clean = reply.replace(/\[\[[^\]]*\]\]/g, '').replace(/[*_#`]/g, '').trim();
      if (tag && tag[2]) setTimeout(() => window.IMAGINATION_SCROLL && window.IMAGINATION_SCROLL(document.getElementById(tag[2])), 700);
      await say(clean, code);
      if (tag && tag[1] === 'tour') { runTour(code); return; }
    } else {
      // offline knowledge base (no key yet, or the API is unreachable)
      const intent = intentOf(text);
      await sleep(450 + Math.random() * 300);
      if (intent === 'tour') { runTour(code); return; }
      const target = SCROLL_FOR[intent];
      if (target) setTimeout(() => window.IMAGINATION_SCROLL && window.IMAGINATION_SCROLL(document.querySelector(target)), 900);
      await say(D[code].a[intent] || D[code].a.fallback, code);
      if (intent === 'bye') { handsFree = false; return; }
    }
    if (handsFree && (open || callActive) && canListen) { await sleep(350); listen(); }
  }

  /* ---------------- "connect Claude" box (key stays on this PC, saved by serve.ps1) ---------------- */
  const CONNECT_UI = {
    en: { title: 'Make Nova truly intelligent', body: 'Paste your Anthropic API key and Nova will hold real conversations powered by Claude.', save: 'Connect', get: 'Get a key', ok: 'Claude connected ✓', bad: 'That key doesn’t look right.', phone: 'Connect Claude from the laptop (localhost).', live: 'Claude' },
    ar: { title: 'خلّي نوفا ذكية بجد', body: 'حط مفتاح Anthropic API بتاعك، ونوفا هتدردش معاك بجد بعقل Claude.', save: 'اربط', get: 'هات مفتاح', ok: 'Claude اتربط ✓', bad: 'المفتاح ده شكله مش مظبوط.', phone: 'اربط Claude من اللابتوب (localhost).', live: 'Claude' },
    arm: { title: 'اجعل نوفا ذكية فعلًا', body: 'ألصق مفتاح Anthropic API الخاص بك لتجري نوفا محادثات حقيقية بقوة Claude.', save: 'ربط', get: 'احصل على مفتاح', ok: 'تم ربط Claude ✓', bad: 'يبدو أن المفتاح غير صحيح.', phone: 'اربط Claude من الحاسوب (localhost).', live: 'Claude' },
    de: { title: 'Mach Nova wirklich intelligent', body: 'Füge deinen Anthropic-API-Schlüssel ein und Nova führt echte Gespräche mit Claude.', save: 'Verbinden', get: 'Schlüssel holen', ok: 'Claude verbunden ✓', bad: 'Der Schlüssel sieht nicht richtig aus.', phone: 'Verbinde Claude vom Laptop aus (localhost).', live: 'Claude' },
    ru: { title: 'Сделайте Нову по-настоящему умной', body: 'Вставьте свой ключ Anthropic API, и Нова будет вести настоящие разговоры на базе Claude.', save: 'Подключить', get: 'Получить ключ', ok: 'Claude подключён ✓', bad: 'Ключ выглядит неверно.', phone: 'Подключите Claude с ноутбука (localhost).', live: 'Claude' }
  };
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  function paintConnect() {
    const box = $('#npConnect'), c = CONNECT_UI[lang] || CONNECT_UI.en;
    if (!box) return;
    $('#npBadge').hidden = !claude.connected;
    $('#npBadge').textContent = '● ' + (claude.brain === 'gemini' ? 'Gemini' : c.live);
    if (claude.connected || claude.offline) { box.hidden = true; return; }
    box.hidden = false;
    $('#ncTitle').textContent = c.title;
    $('#ncBody').textContent = isLocal ? c.body : c.phone;
    $('#ncForm').hidden = !isLocal;
    $('#ncSave').textContent = c.save; $('#ncGet').textContent = c.get;
  }
  $('#ncForm').addEventListener('submit', async e => {
    e.preventDefault();
    const c = CONNECT_UI[lang] || CONNECT_UI.en, input = $('#ncKey'), msg = $('#ncMsg');
    const key = input.value.trim();
    if (!/^sk-ant-/.test(key)) { msg.textContent = c.bad; return; }
    try {
      const r = await fetch('/api/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
      if (!r.ok) throw 0;
      input.value = ''; msg.textContent = c.ok;
      await checkClaude();
    } catch (err) { msg.textContent = c.bad; }
  });

  /* ---------------- guided tour ---------------- */
  let tourActive = false;
  async function runTour(code) {
    const id = ++tourId; tourActive = true;
    if (innerWidth < 900) document.body.classList.add('nova-compact');
    setMode('tour');
    for (const sec of TOUR) {
      if (id !== tourId) return;
      const el = sec === 'top' ? document.querySelector('#top') : document.getElementById(sec);
      window.IMAGINATION_SCROLL && window.IMAGINATION_SCROLL(el);
      await sleep(sec === 'top' ? 300 : 1100);
      if (id !== tourId) return;
      await say(D[code].tour[sec], code);
      await sleep(500);
    }
    if (id === tourId) { tourActive = false; document.body.classList.remove('nova-compact'); setMode('idle'); }
  }
  function stopTour() {
    tourId++;
    if (tourActive) { tourActive = false; document.body.classList.remove('nova-compact'); }
  }
  function stopAll() {
    stopTour(); handsFree = false; stopListening();
    if (canSpeak) { speechSynthesis.cancel(); speakToken++; }
    setMode('idle');
  }

  /* ---------------- orb visual ---------------- */
  let orbRaf = 0, micCtx = null, micStream = null, analyser = null, buf = null;
  async function startMicLevel() {
    if (!matchMedia('(pointer: fine)').matches || !navigator.mediaDevices) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = micCtx.createAnalyser(); analyser.fftSize = 256; buf = new Uint8Array(analyser.frequencyBinCount);
      micCtx.createMediaStreamSource(micStream).connect(analyser);
    } catch (e) { analyser = null; }
  }
  function stopMicLevel() {
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (micCtx) micCtx.close();
    micStream = micCtx = analyser = null;
  }
  function startOrb() {
    if (orbRaf) return;
    const c = $('#npOrb'), ctx = c.getContext('2d');
    let t = 0, smooth = 0;
    const draw = () => {
      if (!open) { orbRaf = 0; return; }
      t += .016;
      let target = 0;
      if (mode === 'listen' && analyser) { analyser.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += Math.abs(v - 128); target = Math.min(1, s / buf.length / 18); }
      else if (mode === 'listen') target = .25 + Math.sin(t * 6) * .1;
      else if (mode === 'speak' || mode === 'tour') { target = (canSpeak && speechSynthesis.speaking ? .45 : .15) + level * .35 + Math.sin(t * 9) * .12; level *= .9; }
      else if (mode === 'think') target = .2 + Math.sin(t * 12) * .1;
      else target = .08;
      smooth += (target - smooth) * .15;
      const W = c.width, H = c.height, cx = W / 2, cy = H / 2, R = W * .26;
      ctx.clearRect(0, 0, W, H);
      const layers = [['rgba(139,108,255,.55)', 1.25, 0], ['rgba(64,230,255,.5)', 1.12, 2], ['rgba(255,95,176,.45)', 1.0, 4]];
      ctx.globalCompositeOperation = 'lighter';
      layers.forEach(([col, k, ph]) => {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + .01; a += Math.PI / 60) {
          const wob = Math.sin(a * 3 + t * 2 + ph) * .06 + Math.sin(a * 5 - t * 3 + ph) * .04 * (1 + smooth * 3) + Math.sin(a * 7 + t * 5) * .03 * smooth * 2;
          const r = R * k * (1 + wob + smooth * .22);
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const gr = ctx.createRadialGradient(cx, cy, R * .1, cx, cy, R * k * 1.3);
        gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      const core = ctx.createRadialGradient(cx - R * .2, cy - R * .25, R * .05, cx, cy, R * .75);
      core.addColorStop(0, '#ffffff'); core.addColorStop(.35, '#b9a8ff'); core.addColorStop(1, 'rgba(40,20,110,0)');
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R * (.62 + smooth * .12), 0, 7); ctx.fill();
      orbRaf = requestAnimationFrame(draw);
    };
    orbRaf = requestAnimationFrame(draw);
  }

  /* ---------------- wiring ---------------- */
  fab.addEventListener('click', openPanel);
  document.querySelectorAll('[data-nova-open]').forEach(b => b.addEventListener('click', () => { openPanel(); }));
  $('#npClose').addEventListener('click', closePanel);
  mic.addEventListener('click', () => {
    if (mode === 'listen') { handsFree = false; stopListening(); return; }
    listen();
  });
  $('#npTourStop').addEventListener('click', stopAll);
  $('#npForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#npText').value.trim(); if (!v) return;
    $('#npText').value = ''; handsFree = false; stopTour();
    if (canSpeak) { speechSynthesis.cancel(); speakToken++; }
    handle(v, false);
  });
  document.querySelectorAll('#npSugg [data-vs]').forEach(b => b.addEventListener('click', () => {
    stopTour(); handsFree = false;
    if (canSpeak) { speechSynthesis.cancel(); speakToken++; }
    handle(L().ui[b.dataset.vs], false);
  }));
  document.querySelectorAll('.nova-lang').forEach(s => s.addEventListener('change', e => { lang = e.target.value; paintUI(); }));
  addEventListener('keydown', e => { if (e.key === 'Escape' && open) closePanel(); });

  /* ---------------- public engine (used by the avatar "video call") ---------------- */
  let callActive = false, pulse = 0;
  window.Voice = {
    onLang() { lang = window.I18N.lang; paintUI(); },
    get mode() { return mode; },
    get lang() { return lang; },
    get canListen() { return canListen; },
    get claude() { return claude.connected; },
    ui: k => L().ui[k],
    speaking: () => canSpeak && speechSynthesis.speaking,
    pulse() { const p = pulse; pulse *= .82; return p; },
    async startCall() {
      callActive = true;
      stopTour();
      if (canSpeak) { speechSynthesis.cancel(); speakToken++; }
      await say(L().a.greet);
      if (callActive && canListen) { handsFree = true; listen(); }
    },
    endCall() { callActive = false; stopAll(); },
    listen() { handsFree = true; listen(); },
    stopListening() { handsFree = false; stopListening(); },
    ask(text) {
      stopTour(); handsFree = false;
      if (canSpeak) { speechSynthesis.cancel(); speakToken++; }
      handle(text, false);
    }
  };
  paintUI();
  checkClaude();
})();
