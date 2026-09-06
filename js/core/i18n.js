"use strict";

// Language/theme state, translation dictionary, and cuisine/style label helpers.

var LANG = "bg";
var THEME = "light";

var I18N = {
  bg:{
    brandTitle:"Cookly",
    brandTagline:"Cook it. Track it. Love it.",
    tooltipAdd:"Добави рецепта", tooltipLibrary:"Моите рецепти",
    heroPopularTitle:"Популярни рецепти", heroProgressTitle:"Моят прогрес", seeAllCta:"Виж всички",
    homeGreetingHi:"Добър ден", homeGreetingNoName:"Добър ден! 👋",
    progressStreak:"дни серия", progressCooked:"сготвени", progressFavorites:"любими",
    formDifficultyLabel:"Трудност",
    difficultyEasy:"Лесна", difficultyMedium:"Средна", difficultyHard:"Трудна",
    librarySearchPlaceholder:"Търси в твоите рецепти...",
    librarySearchEmptyTitle:"Нищо не намерих", librarySearchEmptyBody:"Пробвай друга дума или провери правописа.",
    filterCuisineLabel:"Кухня", filterStyleLabel:"Стил",
    chipAllCuisines:"🌍 Всички", chipAllStyles:"🎲 Всички",
    sortLabel:"Подредба", sortRecent:"🕐 Скорошни", sortRating:"⭐ Оценка",
    loadingText:"Зареждам рецептите... 🍲",
    emptyTitle:"Нищо не съвпада", emptyBody:"Пробвай друг филтър или добави нова рецепта.",
    startBtn:"Старт ▶",
    addViewTitle:"Нова рецепта", tabManual:"✍️ Ръчно", tabLink:"🔗 От линк",
    linkHint:"Постави линк към видео (TikTok / YouTube / Instagram) или към страница с рецепта — ще потърся информация и ще попълня формата вместо теб. Провери и редактирай преди да запазиш!",
    linkFieldLabel:"Линк", linkPlaceholder:"https://...", linkExtractBtn:"Извлечи рецепта ✨",
    linkStatusEmpty:"Постави линк първо 🙂", linkStatusLoading:"Търся рецептата...",
    linkStatusSuccess:"Готово! Провери формата и запази 🎉",
    linkStatusError:"Нещо се обърка при търсенето 😕 Опитай пак или добави ръчно.",
    formNameLabel:"Име на рецептата", formNamePlaceholder:"напр. Гарлик пармезан бомбички",
    formCuisineLabel:"Кухня", formStyleLabel:"Стил на готвене",
    formCuisineOtherLabel:"Уточни кухнята", formCuisineOtherPlaceholder:"напр. Корейска",
    formStyleOtherLabel:"Уточни стила", formStyleOtherPlaceholder:"напр. Фритюр",
    formDescLabel:"Кратко описание", formDescPlaceholder:"Едно-две изречения за рецептата...",
    formTimeLabel:"Общо време (за показване)", formTimePlaceholder:"напр. 45 мин",
    subheadIngredients:"🧺 Продукти", subheadSteps:"📋 Стъпки",
    addIngredientBtn:"+ добави продукт", addStepBtn:"+ добави стъпка",
    ingredientPlaceholder:"напр. 400 г кайма", stepTextPlaceholder:"напр. Вземете и нарежете лука!",
    stepNumLabel:"Стъпка", timerCheckboxLabel:"⏰ Тази стъпка изисква изчакване",
    myRatingLabel:"Твоята оценка:",
    timerTypeLabel:"Тип", timerMinutesLabel:"Минути", timerMessageLabel:"Съобщение при край (по избор)",
    cancelBtn:"Отказ", saveBtn:"Запази рецептата 🎉",
    cookStepOf:"от",
    timerBakeLabel:"🔥 Печене", timerBakeMessage:"Печенето е готово! Извади от фурната.",
    timerFryLabel:"🍳 Пържене", timerFryMessage:"Пърженето е готово!",
    timerFreezeLabel:"❄️ Замразяване", timerFreezeMessage:"Готово е за изваждане от фризера!",
    timerRestLabel:"🛋️ Почивка / стягане", timerRestMessage:"Готово е — стегнало се е!",
    timerProofLabel:"🌾 Втасване", timerProofMessage:"Тестото е готово за разточване!",
    timerStart:"Старт", timerPause:"Пауза ⏸", timerResume:"Продължи ▶", timerDone:"Готово ✓", timerTickingAria:"Отброяване",
    nextBtn:"Напред", finishBtn:"Край", backBtn:"Назад",
    exitConfirmMsg:"Сигурни ли сте, че искате да излезете от тази рецепта?", exitCancelBtn:"Продължи готвенето", exitConfirmBtn:"Излез",
    finishBackBtn:"Към рецептите 📖", langWordIntro:"на",
    tooltipDark:"Тъмна тема", tooltipLight:"Светла тема",
    navLibrary:"Библиотека", navSearch:"Търсене", navFavorites:"Любими", navCart:"Количка", navStats:"Профил",
    cartEmptyTitle:"Количката е празна", cartEmptyBody:"Добави рецепта, за да видиш нужните продукти тук.",
    totalCostLabel:"Общо", substitutesTitle:"Възможни заместители",
    costLoading:"Изчислявам цена...", costError:"Не успях да изчисля цена. Провери отново по-късно.",
    costNote:"Приблизителна цена по текущи цени в Билла/Кауфланд/Лидл.",
    searchPlaceholder:"напр. карбонара, мусака...", searchGoBtn:"Търси",
    searchEmptyTitle:"Търси ястие", searchEmptyBody:"Напиши името на ястие и ще потърся рецепти от познати сайтове.",
    searchStatusLoading:"Търся в известни сайтове за рецепти...", searchAddBtn:"➕ Добави",
    favEmptyTitle:"Нямаш любими още", favEmptyBody:"Докосни сърчицето на рецепта, за да го запазиш тук.",
    favToggleLabel:"Любими",
    statTotalRecipes:"рецепти общо", statCooked:"пъти готвено", statFavorites:"любими", statTopCuisine:"любима кухня",
    streakLabel:"дни поред",
    streakFrozenLabel:"замразена серия 🥶", streakFrozenHint:"Сготви нещо днес, за да я запазиш!",
    profileNamePlaceholder:"Твоето име", profileHint:"Профилът и рецептите се пазят на това устройство, освен ако не влезеш с акаунт по-долу.",
    signInGoogle:"Вход с Google", signInApple:"Вход с Apple",
    oauthNote:"Вход с Apple предстои — засега работи само Google. Профилът по-горе продължава да се пази локално, ако не влезеш.",
    signOutBtn:"Изход", googleSignInError:"Влизането с Google не бе успешно. Опитай пак.",
    accountHeading:"Акаунт и синхронизация",
    accountHint:"Направи си акаунт с имейл и парола, за да виждаш едни и същи рецепти, количка и статистика на всяко устройство.",
    accountTabLogin:"Вход", accountTabRegister:"Регистрация",
    accountEmailPlaceholder:"имейл@пример.com", accountPasswordPlaceholder:"Парола",
    accountPasswordPlaceholderNew:"Парола (мин. 8 символа)", accountPasswordConfirmPlaceholder:"Повтори паролата",
    accountLoginBtn:"Влез", accountRegisterBtn:"Регистрирай се", accountForgotLink:"Забравена парола?",
    accountForgotStep1Hint:"Ще ти пратим код по имейл.", accountSendCodeBtn:"Изпрати код",
    accountForgotStep2Hint:"Провери имейла си за 6-цифрен код (важи 15 минути).",
    accountCodePlaceholder:"Код от имейла", accountResetBtn:"Смени паролата", accountBackToLogin:"← Обратно към вход",
    accountSignedInAs:"Влязъл си с акаунт:",
    accountSyncSynced:"Синхронизирано ✓", accountSyncSyncing:"Синхронизирам…", accountSyncError:"Грешка при синхронизация",
    accountLoggingIn:"Влизам…", accountRegistering:"Регистрирам…", accountSendingCode:"Изпращам код…", accountResetting:"Сменям паролата…",
    accountCodeSent:"Изпратихме код на този имейл, ако има акаунт с него.",
    accountErrInvalidEmail:"Невалиден имейл адрес.", accountErrWeakPassword:"Паролата трябва да е поне 8 символа.",
    accountErrPasswordMismatch:"Паролите не съвпадат.", accountErrEmailTaken:"Вече има акаунт с този имейл — влез вместо да се регистрираш.",
    accountErrInvalidCredentials:"Грешен имейл или парола.", accountErrInvalidCode:"Грешен или изтекъл код.",
    accountErrRateLimited:"Твърде много опити. Изчакай малко и опитай пак.",
    accountErrGeneric:"Нещо се обърка. Опитай пак.", accountLogoutConfirm:"Излязъл си от акаунта. Рецептите остават запазени на това устройство.",
    shareBtn:"🔗 Сподели", shareCreating:"Създавам линк...", shareCopied:"Линкът е копиран! 🎉", shareLinkReady:"Линкът е готов:",
    shareErrGeneric:"Не успях да създам линк. Опитай пак.", shareErrRateLimited:"Твърде много споделяния. Изчакай малко и опитай пак.",
    shareViewLoading:"Зареждам сподeлената рецепта...", shareViewNotFound:"Тази споделена рецепта не съществува вече или линкът е грешен.",
    shareViewErrGeneric:"Нещо се обърка при зареждането. Опитай пак по-късно.",
    shareViewClose:"Затвори", shareViewBadge:"Споделена рецепта",
    shareViewAddBtn:"➕ Добави в моята библиотека", shareViewAdded:"Добавена в библиотеката! ✓", shareViewOpenLibrary:"Виж в библиотеката"
  },
  en:{
    brandTitle:"Cookly",
    brandTagline:"Cook it. Track it. Love it.",
    tooltipAdd:"Add recipe", tooltipLibrary:"My recipes",
    heroPopularTitle:"Popular recipes", heroProgressTitle:"My progress", seeAllCta:"See all",
    homeGreetingHi:"Good day", homeGreetingNoName:"Good day! 👋",
    progressStreak:"day streak", progressCooked:"cooked", progressFavorites:"favorites",
    formDifficultyLabel:"Difficulty",
    difficultyEasy:"Easy", difficultyMedium:"Medium", difficultyHard:"Hard",
    librarySearchPlaceholder:"Search your recipes...",
    librarySearchEmptyTitle:"No matches", librarySearchEmptyBody:"Try a different word or check the spelling.",
    filterCuisineLabel:"Cuisine", filterStyleLabel:"Style",
    chipAllCuisines:"🌍 All", chipAllStyles:"🎲 All",
    sortLabel:"Sort by", sortRecent:"🕐 Recent", sortRating:"⭐ Rating",
    loadingText:"Loading recipes... 🍲",
    emptyTitle:"Nothing matches", emptyBody:"Try a different filter or add a new recipe.",
    startBtn:"Start ▶",
    addViewTitle:"New recipe", tabManual:"✍️ Manual", tabLink:"🔗 From link",
    linkHint:"Paste a link to a video (TikTok / YouTube / Instagram) or a recipe page — I'll look it up and fill in the form for you. Review and edit before saving!",
    linkFieldLabel:"Link", linkPlaceholder:"https://...", linkExtractBtn:"Extract recipe ✨",
    linkStatusEmpty:"Paste a link first 🙂", linkStatusLoading:"Looking up the recipe...",
    linkStatusSuccess:"Done! Check the form and save 🎉",
    linkStatusError:"Something went wrong 😕 Try again or add it manually.",
    formNameLabel:"Recipe name", formNamePlaceholder:"e.g. Garlic parmesan bombs",
    formCuisineLabel:"Cuisine", formStyleLabel:"Cooking style",
    formCuisineOtherLabel:"Specify the cuisine", formCuisineOtherPlaceholder:"e.g. Korean",
    formStyleOtherLabel:"Specify the style", formStyleOtherPlaceholder:"e.g. Deep-fried",
    formDescLabel:"Short description", formDescPlaceholder:"One or two sentences about the recipe...",
    formTimeLabel:"Total time (for display)", formTimePlaceholder:"e.g. 45 min",
    subheadIngredients:"🧺 Ingredients", subheadSteps:"📋 Steps",
    addIngredientBtn:"+ add ingredient", addStepBtn:"+ add step",
    ingredientPlaceholder:"e.g. 400 g ground beef", stepTextPlaceholder:"e.g. Take and chop the onion!",
    stepNumLabel:"Step", timerCheckboxLabel:"⏰ This step needs waiting",
    myRatingLabel:"Your rating:",
    timerTypeLabel:"Type", timerMinutesLabel:"Minutes", timerMessageLabel:"Message when done (optional)",
    cancelBtn:"Cancel", saveBtn:"Save recipe 🎉",
    cookStepOf:"of",
    timerBakeLabel:"🔥 Baking", timerBakeMessage:"Baking is done! Take it out of the oven.",
    timerFryLabel:"🍳 Frying", timerFryMessage:"Frying is done!",
    timerFreezeLabel:"❄️ Freezing", timerFreezeMessage:"It's ready to come out of the freezer!",
    timerRestLabel:"🛋️ Resting / setting", timerRestMessage:"It's ready — it has set!",
    timerProofLabel:"🌾 Proofing", timerProofMessage:"The dough is ready to roll out!",
    timerStart:"Start", timerPause:"Pause ⏸", timerResume:"Resume ▶", timerDone:"Done ✓", timerTickingAria:"Counting down",
    nextBtn:"Next", finishBtn:"Finish", backBtn:"Back",
    exitConfirmMsg:"Are you sure you want to leave this recipe?", exitCancelBtn:"Keep cooking", exitConfirmBtn:"Leave",
    finishBackBtn:"Back to recipes 📖", langWordIntro:"in",
    tooltipDark:"Dark mode", tooltipLight:"Light mode",
    navLibrary:"Library", navSearch:"Search", navFavorites:"Favorites", navCart:"Cart", navStats:"Profile",
    cartEmptyTitle:"Your cart is empty", cartEmptyBody:"Add a recipe to see its shopping list here.",
    totalCostLabel:"Total", substitutesTitle:"Possible substitutes",
    costLoading:"Estimating cost...", costError:"Couldn't estimate the cost. Try again later.",
    costNote:"Approximate, based on current Billa/Kaufland/Lidl prices.",
    searchPlaceholder:"e.g. carbonara, tacos...", searchGoBtn:"Search",
    searchEmptyTitle:"Search for a dish", searchEmptyBody:"Type a dish name and I'll look for recipes on well-known sites.",
    searchStatusLoading:"Searching well-known recipe sites...", searchAddBtn:"➕ Add",
    favEmptyTitle:"No favorites yet", favEmptyBody:"Tap the heart on a recipe to save it here.",
    favToggleLabel:"Favorites",
    statTotalRecipes:"total recipes", statCooked:"times cooked", statFavorites:"favorites", statTopCuisine:"top cuisine",
    streakLabel:"day streak",
    streakFrozenLabel:"streak frozen 🥶", streakFrozenHint:"Cook something today to keep it alive!",
    profileNamePlaceholder:"Your name", profileHint:"Your profile and recipes are saved on this device, unless you sign in with an account below.",
    signInGoogle:"Sign in with Google", signInApple:"Sign in with Apple",
    oauthNote:"Apple sign-in is coming later — only Google works for now. The profile above still saves locally if you don't sign in.",
    signOutBtn:"Sign out", googleSignInError:"Google sign-in didn't work. Please try again.",
    accountHeading:"Account & sync",
    accountHint:"Make an account with email and password to see the same recipes, cart and stats on every device.",
    accountTabLogin:"Log in", accountTabRegister:"Sign up",
    accountEmailPlaceholder:"email@example.com", accountPasswordPlaceholder:"Password",
    accountPasswordPlaceholderNew:"Password (min. 8 characters)", accountPasswordConfirmPlaceholder:"Confirm password",
    accountLoginBtn:"Log in", accountRegisterBtn:"Sign up", accountForgotLink:"Forgot password?",
    accountForgotStep1Hint:"We'll email you a code.", accountSendCodeBtn:"Send code",
    accountForgotStep2Hint:"Check your email for a 6-digit code (valid for 15 minutes).",
    accountCodePlaceholder:"Code from the email", accountResetBtn:"Change password", accountBackToLogin:"← Back to log in",
    accountSignedInAs:"Signed in with account:",
    accountSyncSynced:"Synced ✓", accountSyncSyncing:"Syncing…", accountSyncError:"Sync error",
    accountLoggingIn:"Logging in…", accountRegistering:"Signing up…", accountSendingCode:"Sending code…", accountResetting:"Changing password…",
    accountCodeSent:"If that email has an account, we sent it a code.",
    accountErrInvalidEmail:"Invalid email address.", accountErrWeakPassword:"Password must be at least 8 characters.",
    accountErrPasswordMismatch:"Passwords don't match.", accountErrEmailTaken:"That email already has an account — log in instead.",
    accountErrInvalidCredentials:"Wrong email or password.", accountErrInvalidCode:"Wrong or expired code.",
    accountErrRateLimited:"Too many attempts. Please wait a bit and try again.",
    accountErrGeneric:"Something went wrong. Please try again.", accountLogoutConfirm:"Signed out. Your recipes are still saved on this device.",
    shareBtn:"🔗 Share", shareCreating:"Creating a link...", shareCopied:"Link copied! 🎉", shareLinkReady:"Your link is ready:",
    shareErrGeneric:"Couldn't create a link. Please try again.", shareErrRateLimited:"Too many shares. Please wait a bit and try again.",
    shareViewLoading:"Loading the shared recipe...", shareViewNotFound:"This shared recipe no longer exists, or the link is wrong.",
    shareViewErrGeneric:"Something went wrong loading it. Please try again later.",
    shareViewClose:"Close", shareViewBadge:"Shared recipe",
    shareViewAddBtn:"➕ Add to my library", shareViewAdded:"Added to your library! ✓", shareViewOpenLibrary:"View in library"
  }
};
function t(key){ return (I18N[LANG] && I18N[LANG][key]) || (I18N.bg[key] || key); }

var CUISINES = ["Италианска","Френска","Китайска","Японска","Индийска","Мексиканска","Испанска","Гръцка","Турска","Българска","Американска","Тайландска","Виетнамска","Близкоизточна","Друга"];
var STYLES = ["Печене","Пържене","Задушаване","Варене","Скара/грил","Без готвене","Бавно готвене","На пара","Друго"];

var CUISINE_EN = {
  "Италианска":"Italian","Френска":"French","Китайска":"Chinese","Японска":"Japanese","Индийска":"Indian",
  "Мексиканска":"Mexican","Испанска":"Spanish","Гръцка":"Greek","Турска":"Turkish","Българска":"Bulgarian",
  "Американска":"American","Тайландска":"Thai","Виетнамска":"Vietnamese","Близкоизточна":"Middle Eastern","Друга":"Other"
};
var STYLE_EN = {
  "Печене":"Baking","Пържене":"Frying","Задушаване":"Stewing","Варене":"Boiling","Скара/грил":"Grill",
  "Без готвене":"No-cook","Бавно готвене":"Slow cooking","На пара":"Steamed","Друго":"Other"
};
function cuisineLabel(v){ return LANG==="en" ? (CUISINE_EN[v] || v) : v; }
function styleLabel(v){ return LANG==="en" ? (STYLE_EN[v] || v) : v; }

// Canonical difficulty values always stay Bulgarian internally (same pattern
// as CUISINES/STYLES above) — difficultyLabel() translates for display.
var DIFFICULTIES = ["Лесна","Средна","Трудна"];
var DIFFICULTY_KEY = { "Лесна":"difficultyEasy", "Средна":"difficultyMedium", "Трудна":"difficultyHard" };
function difficultyLabel(v){ return t(DIFFICULTY_KEY[v] || DIFFICULTY_KEY["Средна"]); }

var CUISINE_EMOJI = {
  "Италианска":"🍝","Френска":"🥐","Китайска":"🥡","Японска":"🍣","Индийска":"🍛","Мексиканска":"🌮",
  "Испанска":"🥘","Гръцка":"🥙","Турска":"🧆","Българска":"🥗","Американска":"🍔","Тайландска":"🍜",
  "Виетнамска":"🍲","Близкоизточна":"🧆","Друга":"🍽️"
};
var CARD_COLORS = ["#FFE1E1","#FFEBC7","#FFF6C0","#DFF6E3","#D8F1F5","#DCE6FF","#EBE0FF","#FBDCF0"];

var FOOD_ICONS = [
  {re:/лук/i, emoji:"🧅"}, {re:/чесън/i, emoji:"🧄"},
  {re:/чедър|кашкавал|сирене|моцарел|пармезан/i, emoji:"🧀"},
  {re:/яйц/i, emoji:"🥚"}, {re:/масло/i, emoji:"🧈"},
  {re:/домат/i, emoji:"🍅"}, {re:/краставиц/i, emoji:"🥒"},
  {re:/кайма|месо|телешк|свинск/i, emoji:"🥩"}, {re:/пиле|пилешк/i, emoji:"🍗"},
  {re:/риба|сьомга|скариди/i, emoji:"🐟"}, {re:/брашно/i, emoji:"🌾"},
  {re:/захар/i, emoji:"🍬"}, {re:/мляко/i, emoji:"🥛"}, {re:/лимон/i, emoji:"🍋"},
  {re:/чушк|пипер/i, emoji:"🌶️"}, {re:/гъби/i, emoji:"🍄"},
  {re:/магданоз|копър|босилек|подправ/i, emoji:"🌿"},
  {re:/тесто|хляб|кифл/i, emoji:"🍞"}, {re:/ориз/i, emoji:"🍚"},
  {re:/олио|зехтин/i, emoji:"🫒"}, {re:/шоколад/i, emoji:"🍫"},
  {re:/ябълк/i, emoji:"🍎"}, {re:/картоф/i, emoji:"🥔"}, {re:/морков/i, emoji:"🥕"},
  {re:/бекон/i, emoji:"🥓"}, {re:/вино/i, emoji:"🍷"}, {re:/фурна/i, emoji:"🔥"},
  {re:/onion/i, emoji:"🧅"}, {re:/garlic/i, emoji:"🧄"}, {re:/cheese|cheddar|mozzarella|parmesan/i, emoji:"🧀"},
  {re:/egg/i, emoji:"🥚"}, {re:/butter/i, emoji:"🧈"}, {re:/tomato/i, emoji:"🍅"},
  {re:/beef|meat|pork/i, emoji:"🥩"}, {re:/chicken/i, emoji:"🍗"}, {re:/dough|bread/i, emoji:"🍞"}
];
var STICKER_CORNERS = ["top:-12px; right:-10px;","bottom:-12px; left:-10px;","top:-12px; left:-10px;"];
function pickSticker(text){
  var matches = FOOD_ICONS.filter(function(f){ return f.re.test(text); });
  if(matches.length === 0) return null;
  if(Math.random() >= 0.55) return null;
  return matches[Math.floor(Math.random()*matches.length)].emoji;
}

var BON_APPETIT = [
  {msg:"Приятно хранене!", langBg:"български", langEn:"Bulgarian", translation:null},
  {msg:"Buon appetito!", langBg:"италиански", langEn:"Italian", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"Bon appétit!", langBg:"френски", langEn:"French", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"¡Buen provecho!", langBg:"испански", langEn:"Spanish", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"Guten Appetit!", langBg:"немски", langEn:"German", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"Bom apetite!", langBg:"португалски", langEn:"Portuguese", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"Καλή όρεξη!", langBg:"гръцки", langEn:"Greek", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"Afiyet olsun!", langBg:"турски", langEn:"Turkish", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"召し上がれ！", langBg:"японски", langEn:"Japanese", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"慢慢吃！", langBg:"китайски", langEn:"Chinese", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"Приятного аппетита!", langBg:"руски", langEn:"Russian", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"Smacznego!", langBg:"полски", langEn:"Polish", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"Smaklig måltid!", langBg:"шведски", langEn:"Swedish", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}},
  {msg:"맛있게 드세요!", langBg:"корейски", langEn:"Korean", translation:{bg:"Приятно хранене!", en:"Enjoy your meal!"}}
];

var SEED_RECIPE = {
  id: "seed-cheeseburger-bombs",
  name: "Гарлик пармезан бомбички с кайма",
  cuisine: "Американска",
  style: "Печене",
  difficulty: "Средна",
  description: "Топчета от меко тесто, пълнени с кайма и чедър, намазани с чесново-пармезаново масло.",
  time: "50 мин",
  dateAdded: Date.now() - 1000,
  ingredients: [
    "400 г кайма (свинско-телешка смес)", "1 глава лук, ситно нарязана", "4 скилидки чесън, смлени",
    "1 с.л. вустърсос", "сол и черен пипер", "100 г чедър, нарязан на кубчета",
    "80 г настърган чедър или моцарела", "6 кръгчета тесто за кифли (Ø10-12см)",
    "1 яйце, разбито", "50 г краве масло", "40 г настърган пармезан", "прясен магданоз"
  ],
  steps: [
    {text:"Обелете и нарежете ситно 1 глава лук.", timer:null},
    {text:"Загрейте малко олио в тиган и запържете лука, докато омекне.", timer:null},
    {text:"Добавете каймата и смления чесън. Пържете, докато каймата се разпадне и се сготви напълно.", timer:null},
    {text:"Подправете с вустърсос, сол и черен пипер. Отцедете мазнината и оставете плънката да изстине.", timer:null},
    {text:"Разбъркайте изстиналата плънка с настъргания чедър или моцарела.", timer:null},
    {text:"Разделете тестото на 6 топки и сплескайте всяка в кръгче с диаметър 10-12 см.", timer:null},
    {text:"Сложете плънка и 2-3 кубчета чедър в средата на всяко кръгче. Съберете краищата, прищипете стегнато и оформете гладко топче.", timer:null},
    {text:"Наредете топчетата с шева надолу в тава с хартия за печене и намажете отгоре с разбито яйце.", timer:null},
    {text:"Печете на 190°C.", timer:{seconds:1020, type:"bake", label:"🔥 Печене на 190°C", message:"Печенето е готово! Извади от фурната."}},
    {text:"Докато се пекат, разтопете маслото и разбъркайте с чесъна и половината пармезан.", timer:null},
    {text:"Извадете топчетата и веднага ги намажете с чесновото масло. Поръсете с останалия пармезан и магданоз. Сервирайте топли.", timer:null}
  ]
};

function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(function(el){ el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("[data-i18n-ph]").forEach(function(el){ el.placeholder = t(el.getAttribute("data-i18n-ph")); });
  document.querySelectorAll("[data-i18n-title]").forEach(function(el){ el.title = t(el.getAttribute("data-i18n-title")); });
  elLangBg.classList.toggle("is-active", LANG === "bg");
  elLangEn.classList.toggle("is-active", LANG === "en");
  fillSelectTranslated(elCuisineSel, CUISINES, cuisineLabel);
  fillSelectTranslated(elStyleSel, STYLES, styleLabel);
  if(elCount) elCount.textContent = recipes.length ? countLabel(recipes.length) : "";
  if(typeof renderDifficultyRow === "function") renderDifficultyRow();
  applyTheme();
}

function applyTheme(){
  $("rnRoot").classList.toggle("theme-dark", THEME === "dark");
  elThemeBtn.textContent = THEME === "dark" ? "☀️" : "🌙";
  elThemeBtn.title = THEME === "dark" ? t("tooltipLight") : t("tooltipDark");
}
function setTheme(newTheme){
  if(THEME === newTheme) return;
  THEME = newTheme;
  window.storage.set("app-theme", THEME, false).catch(function(){});
  applyTheme();
}
elThemeBtn.addEventListener("click", function(){ setTheme(THEME === "dark" ? "light" : "dark"); });

function setLang(newLang){
  if(LANG === newLang) return;
  LANG = newLang;
  window.storage.set("app-lang", LANG, false).catch(function(){});
  applyI18n();
  refreshCurrentView();
}
elLangBg.addEventListener("click", function(){ setLang("bg"); });
elLangEn.addEventListener("click", function(){ setLang("en"); });

function fillSelectTranslated(el, canonicalList, labelFn){
  var prevVal = el.value;
  el.innerHTML = "";
  canonicalList.forEach(function(v){
    var opt = document.createElement("option");
    opt.value = v; opt.textContent = labelFn(v);
    el.appendChild(opt);
  });
  if(canonicalList.indexOf(prevVal) > -1) el.value = prevVal;
}
