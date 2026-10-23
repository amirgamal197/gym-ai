/**
 * exercises-data.js — Exercise Database (Workout Engine)
 * ---------------------------------------------------------------
 * Standalone exercise reference library: searchable/filterable by
 * muscle group, equipment, and difficulty, independent from the
 * 3-day program content in data.js.
 *
 * v1.2.0 — Library expansion (see CHANGELOG.md for full notes):
 *  - Split into 12 muscle groups instead of 7 (chest, back,
 *    shoulders, biceps, triceps, forearms, quads, hamstrings,
 *    glutes, calves, core, traps) so filtering matches how lifters
 *    actually think about "arm day" / "leg day" splits.
 *  - Every exercise inside a group is ordered by (1) evidence-
 *    supported effectiveness for the target muscle, (2) muscle
 *    targeting/loading quality, (3) usable range of motion, (4)
 *    progressive-overload potential, (5) practicality/stability —
 *    then roughly Beginner → Intermediate → Advanced within ties.
 *    This is a "best-supported-first, but keep every popular
 *    option" library — nothing was removed for being merely less
 *    optimal than something else; see README/CHANGELOG for the
 *    full source list and where evidence is thin.
 *  - The 28 exercises that existed in v1.1.0 keep their original
 *    `id` unchanged (some got reassigned to a more specific new
 *    group, e.g. `rdl` moved from "legs" to "hamstrings") so any
 *    favorites already saved in a user's localStorage keep working.
 *
 * v1.3.2 — Media fields restructured (see CHANGELOG.md for full notes):
 *  - `mwUrl` renamed to `illustration`: a verified direct exercise page,
 *    either MuscleWiki (preferred) or MuscleAndStrength (fallback when
 *    no direct MuscleWiki page exists) — never guessed from the name.
 *  - Manually-verified YouTube `vid` ids were removed entirely. Every
 *    exercise now gets the same auto-built YouTube *search* link (see
 *    ui.js tutorialLink + data.js YT_SEARCH) — simpler and consistent,
 *    no per-exercise video curation to keep correct over time.
 *
 * Nothing in this file touches the DOM — pure content, like data.js.
 * ---------------------------------------------------------------
 */

function ExDB(o) {
  return Object.assign(
    {
      id: "", en: "", ar: "", group: "", primary: "", secondary: "",
      equipment: "Bodyweight", difficulty: "Intermediate",
      instructions: [], mistakes: [], tips: [],
      // illustration: direct verified MuscleWiki or MuscleAndStrength page —
      // never auto-generated/guessed from the exercise name (see ui.js
      // illustrationLink). tutorial is NOT stored per-exercise — it is a
      // YouTube search link auto-built from ex.en at render time (see
      // ui.js tutorialLink / data.js YT_SEARCH).
      illustration: null, gif: null,
    },
    o
  );
}

// `note` = short evidence-informed intro for the group, shown in the
// library UI when that group is filtered. Kept intentionally brief —
// full source list lives in CHANGELOG.md.
const MUSCLE_GROUPS = [
  { key: "chest", icon: "🎯", label: "Chest", ar: "الصدر", note: "بريس البار/الدمبلز المستوي والمائل هو الأساس الأكتر توثيقًا لبناء الصدر (EMG وتجارب تدريب)؛ زاوية الميل بتحدد نسبة الشغل بين الصدر العلوي والأوسط. الفراشة والكيبل مفيدين كإضافة للشد في وضع الإطالة، مش كبديل للحركات المركبة." },
  { key: "back", icon: "🔙", label: "Back", ar: "الظهر", note: "السحب العمودي (سحب علوي/نزول أمامي) بيبني عرض الظهر (Lats)، والتجديف الأفقي (تجديف/رو) بيبني السمك والعضلة بين الكتفين. الاتنين محتاجين في أي برنامج متكامل — مفيش واحد بيغني عن التاني." },
  { key: "shoulders", icon: "🏔️", label: "Shoulders", ar: "الأكتاف", note: "بريس الكتف (بار أو دمبلز) بيدي أكبر حمل كلي على الكتف الأمامي والجانبي، لكن الرفرفة الجانبية لسه أفضل حركة لعزل الكتف الجانبي (أكبر عضلة في شكل الكتف الكروي). الكتف الخلفي محتاج تمارين سحب/فتح منفصلة زي الفيس بول عشان مبيشتغلش كفاية في تمارين الدفع." },
  { key: "biceps", icon: "💪", label: "Biceps", ar: "البايسبس", note: "أي شكل ثني للمرفق بيشغل الباي، لكن زاوية الكتف بتغيّر مين الراس (الطويل/القصير) اللي بيشتغل أكتر. الثني على بنش مائل (Incline) بيشد الراس الطويلة في وضع مطول وبقى مدعوم ببحث حديث على أهمية التدريب في مدى الإطالة." },
  { key: "triceps", icon: "🦾", label: "Triceps", ar: "الترايسبس", note: "الراس الطويلة بس هي اللي بتعدي مفصل الكتف، فبتحتاج حركات فوق الراس (Overhead) عشان تتمد بالكامل وتاخد حمل في وضعها المطول — دراسات حديثة (Maeo وزملاؤه) لقت نمو أكبر فيها مقارنة بالبوش داون العادي. البوش داون والحركات التانية لسه فعالة ومهمة للراسين التانيين." },
  { key: "forearms", icon: "✊", label: "Forearms", ar: "الساعد", note: "الأبحاث المخصصة للساعد قليلة نسبيًا مقارنة بالعضلات الكبيرة، وأغلب الدليل عملي/خبرة مدربين أكتر من تجارب علمية كبيرة. أي تمرين ثني/فرد للرسغ أو مسكة تقيلة (زي الفارمرز كاري) بيدّي تحفيز كويس." },
  { key: "quads", icon: "🦵", label: "Quads", ar: "عضلات الفخذ الأمامية", note: "السكوات وتنويعاته بيدوا أكبر حمل كلي وأفضل نقل لقوة وظيفية، لكن ليج إكستنشن بيدي أعلى تفعيل مباشر للكوادز خصوصًا Rectus Femoris لأنه معزول تمامًا عن الجلوت والهامسترينج. الاتنين مكملين لبعض مش بدائل." },
  { key: "hamstrings", icon: "🦿", label: "Hamstrings", ar: "عضلات الفخذ الخلفية", note: "تمارين الـ Hip Hinge (رفعة رومانية) بتشتغل على الهامسترينج في وضع مطول عند الورك، وده مرتبط بنمو أكبر حسب أبحاث حديثة (Maeo 2021) قارنت بين ثني الرجل قاعد (مطول) وواقف (مقصر). النوردك كيرل عنده أقوى دليل لتقليل إصابات الهامسترينج تحديدًا." },
  { key: "glutes", icon: "🍑", label: "Glutes", ar: "عضلات المؤخرة", note: "الهيب ثرست بيدي أعلى تفعيل EMG لعضلة الجلوت الأساسية لأنه بيحمّلها في وضعها الأقصر (قمة مد الورك)، بينما السكوات والتمارين المركبة بتشتغل على الجلوت في مدى حركة أوسع مع عضلات تانية. دراسات نمو حديثة لقت الفرق بينهم في الحجم النهائي صغير." },
  { key: "calves", icon: "🦶", label: "Calves", ar: "عضلات السمانة", note: "عضلة الـ Gastrocnemius بتعدي مفصل الركبة فبتشتغل أكتر في الرفعة الواقفة (ركبة مفرودة)، أما الـ Soleus (تحتها) فبيشتغل بشكل مركّز أكتر لما الركبة مثنية زي الرفعة القاعدة — الفرق ده موثق بيولوجيًا وميكانيكيًا مش مجرد رأي." },
  { key: "core", icon: "🧱", label: "Core", ar: "عضلات البطن", note: "ترتيب فاعلية تمارين البطن بالـ EMG (زي دراسة ACE الشهيرة) بيدي فكرة تقريبية بس مش مقياس مباشر للنمو العضلي، فالترتيب هنا بيراعي كمان مدى الحركة والقدرة على زيادة الحمل تدريجيًا (تحميل خارجي زي الكيبل كرنش أفضل من كرنش عادي على المدى الطويل)." },
  { key: "traps", icon: "🗻", label: "Traps", ar: "الترابيس", note: "رفع الكتفين (Shrug) بأنواعه هو الحركة الأكتر توثيقًا وبساطة لتحميل الترابيس العلوي مباشرة، والحمل الوظيفي (زي الفارمرز كاري) بيضيف مكون ثبات إضافي بجانب الحجم." },
];

const EQUIPMENT_TYPES = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Band"];

const EQUIPMENT_LABELS = {
  Barbell: "بار", Dumbbell: "دمبلز", Cable: "كيبل",
  Machine: "جهاز", Bodyweight: "وزن الجسم", Band: "حزام مقاومة",
};

const EXERCISES = [
  // ================= CHEST =================
  // Ordered: flat/incline barbell & DB presses (largest evidence base for
  // overall pec hypertrophy + best overload capacity) → machine/smith
  // variants (comparable tension, more stability) → push-up (bodyweight,
  // beginner-accessible) → fly/isolation work (best stretch-position
  // tension, lower overload ceiling) → dip/decline (popular, more
  // lower-chest emphasis but overlaps heavily with flat pressing).
  ExDB({
    id: "flat-barbell-bench", en: "Flat Barbell Bench Press", ar: "بنش فلات بار", group: "chest",
    primary: "Mid Chest", secondary: "Front Delts, Triceps", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["استلقي على البنش وقدميك ثابتين بالأرض.", "امسك البار بمسافة أعرض من الكتف شوية.", "نزّل البار لمنتصف الصدر بتحكم.", "ادفع لفوق في خط شبه مستقيم لحد مد الذراع."],
    mistakes: ["ارتداد البار من على الصدر (Bouncing) بدل التحكم في النزول.", "رفع الحوض عن البنش للمساعدة في الدفع."],
    tips: ["اعصر لوحي الكتف ببعض قبل ما تبدأ.", "خلي معصمك مستقيم فوق الكوع طول الحركة."],
    illustration: "https://musclewiki.com/exercise/barbell-bench-press",
  }),
  ExDB({
    id: "machine-chest-press", en: "Machine Chest Press", ar: "مشين تشست بريس", group: "chest",
    primary: "Mid Chest", secondary: "Front Delts, Triceps", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اضبط ارتفاع المقعد لحد ما المقابض بمستوى منتصف الصدر.", "امسك المقابض وادفع لقدام لمد شبه كامل للذراع.", "ارجع ببطء وتحكم لحد ما تحس بشد خفيف في الصدر."],
    mistakes: ["ضبط ارتفاع مقعد غلط بيحوّل الشغل للكتف بدل الصدر.", "قفل المرفق بقوة في نهاية الدفع."],
    tips: ["مسار الحركة الثابت بيخليك تركز على الصدر من غير قلق على التوازن — ممتاز للمبتدئين ولما تكون تعبان من تمارين تانية.", "جرب زوايا مقعد مختلفة (لو الجهاز بيسمح) لتنويع التحفيز."],
    illustration: "https://musclewiki.com/exercise/machine-chest-press",
  }),
  ExDB({
    id: "incline-barbell-bench", en: "Incline Barbell Bench Press", ar: "بنش إنكلاين بار", group: "chest",
    primary: "Upper Chest", secondary: "Front Delts, Triceps", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["اضبط البنش على زاوية 15°-30° (زاوية أعلى بتحول الشغل للكتف أكتر من الصدر).", "امسك البار بمسافة أعرض من الكتف شوية.", "نزّل البار لأعلى الصدر بتحكم.", "ادفع لفوق في خط شبه مستقيم."],
    mistakes: ["زاوية بنش عالية أوي (45°+) بتحول الشغل للكتف الأمامي بدل الصدر العلوي.", "نزول البار لمكان مختلف كل مرة (لازم يكون ثابت تحت الترقوة)."],
    tips: ["أقل زاوية ممكنة تحس فيها بشد واضح في الصدر العلوي كفاية — مش لازم زاوية عالية.", "ابدأ بوزن أقل من الفلات بشوية لحد ما تظبط الفورم."],
    illustration: "https://musclewiki.com/exercise/barbell-incline-bench-press",
  }),
  ExDB({
    id: "flat-db-press", en: "Flat Dumbbell Bench Press", ar: "بنش فلات دمبلز", group: "chest",
    primary: "Mid Chest", secondary: "Front Delts, Triceps", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["استلقي على البنش وامسك دمبلز في كل إيد بمستوى الصدر.", "ادفع الدمبلز لفوق مع تقريبهم من بعض شوية في القمة.", "انزل ببطء لحد ما تحس بشد جيد في الصدر (مدى حركة أوسع من البار)."],
    mistakes: ["نزول غير متماثل بين الإيدين.", "فتح المرفقين أوي للجانبين بيحمّل الكتف زيادة."],
    tips: ["مدى الحركة الأوسع من البار ميزته الأساسية — استغله بنزول كامل ومتحكم فيه.", "لو صعب تنزل الدمبلز في الآخر، خد مساعدة أو استخدم وزن أخف."],
    illustration: "https://musclewiki.com/exercise/dumbbell-bench-press",
  }),
  ExDB({
    id: "incline-db-press", en: "Incline DB Press", ar: "إنكلاين دمبلز بريس", group: "chest",
    primary: "Upper Chest", secondary: "Front Delts, Triceps", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["اضبط البنش على زاوية 30°.", "امسك دمبلز في كل إيد فوق الصدر العلوي.", "ادفع لفوق لحد مد الذراع من غير قفل كامل للمرفق.", "انزل ببطء لحد ما تحس بشد خفيف في الصدر."],
    mistakes: ["زاوية بنش عالية أوي (45°+) بتحول الشغل للكتف.", "قفل المرفق بالكامل فوق بيفرغ الشد عن العضلة."],
    tips: ["ركز على عصر الصدر في القمة لثانية.", "لو حسيت الكتف بيشتغل أكتر من الصدر، قلل الزاوية."],
    illustration: "https://musclewiki.com/exercise/dumbbell-incline-bench-press",
  }),
  ExDB({
    id: "pushup", en: "Push-up", ar: "تمرين الضغط", group: "chest",
    primary: "Chest", secondary: "Triceps, Front Delts", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["ابدأ في وضع بلانك، الإيدين تحت الكتف مباشرة.", "انزل جسمك كله كوحدة واحدة لحد ما صدرك يقرب من الأرض.", "ادفع لفوق لحد مد الذراع بالكامل."],
    mistakes: ["سقوط الحوض لتحت أثناء الحركة.", "نزول جزئي بس (مدى حركة قصير)."],
    tips: ["اشد البطن والجلوت طول الحركة عشان الجسم يفضل خط واحد.", "لو صعب، ابدأ على الركب أو على حافة مرتفعة."],
    illustration: "https://musclewiki.com/exercise/push-up",
  }),
  ExDB({
    id: "cable-fly", en: "Cable Fly", ar: "فراشة كيبل", group: "chest",
    primary: "Chest (Inner/Outer)", secondary: "Front Delts", equipment: "Cable", difficulty: "Beginner",
    instructions: ["اضبط البكرتين فوق مستوى الكتف.", "امسك المقابض ومد ذراعيك للجانبين بانحناءة خفيفة في المرفق.", "اجمع الإيدين قدامك في حركة قوسية لحد ما تتلاقى."],
    mistakes: ["ثني المرفق كتير فبيتحول لتمرين دفع بدل فراشة.", "استخدام وزن تقيل بيخلي الحركة تعتمد على الزخم."],
    tips: ["ركز على عصر الصدر في نقطة التلاقي.", "تحكم في مرحلة الفتح (Eccentric) ببطء."],
    illustration: "https://musclewiki.com/exercise/cable-pec-fly",
  }),
  ExDB({
    id: "pec-deck-fly", en: "Pec Deck Machine Fly", ar: "فراشة جهاز", group: "chest",
    primary: "Chest (Inner)", secondary: "Front Delts", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد والضهر ملزق بالمسند، امسك المقابض بمستوى الصدر.", "اجمع الإيدين قدامك بحركة قوسية لحد التلاقي.", "ارجع ببطء لحد ما تحس بشد في الصدر."],
    mistakes: ["الاستناد على الزخم بدل التحكم في الحركة كاملة.", "فتح الذراعين أكتر من مدى مريح للكتف."],
    tips: ["بديل ممتاز للكيبل فراي لو الجهاز متاح — ثابت وسهل التحكم فيه.", "وقفة نص ثانية في نقطة العصر بتزود التفعيل."],
    illustration: "https://musclewiki.com/exercise/machine-pec-fly",
  }),
  ExDB({
    id: "low-to-high-cable-fly", en: "Low-to-High Cable Fly", ar: "فراشة كيبل لو-تو-هاي", group: "chest",
    primary: "Upper Chest", secondary: "Front Delts", equipment: "Cable", difficulty: "Intermediate",
    instructions: ["اضبط البكرتين تحت مستوى الكتف.", "امسك المقابض وارفع الإيدين بحركة قوسية لفوق ولقدام.", "اجمع الإيدين فوق مستوى الوش تقريبًا، وارجع ببطء."],
    mistakes: ["استخدام الكتف بدل الصدر لرفع الوزن لفوق.", "زاوية بكرة عالية أوي بتقلب الحركة لتمرين مختلف."],
    tips: ["اتجاه الشد من تحت لفوق بيدي تحفيز إضافي للصدر العلوي مكمّل للبريس المائل.", "حركة بطيئة ومتحكم فيها أهم من الوزن التقيل هنا."],
    illustration: "https://www.muscleandstrength.com/exercises/cable-lower-chest-raise.html",
  }),
  ExDB({
    id: "chest-dip", en: "Chest Dip", ar: "دبس صدر", group: "chest",
    primary: "Lower Chest", secondary: "Triceps, Front Delts", equipment: "Bodyweight", difficulty: "Advanced",
    instructions: ["امسك القضبان المتوازية وارفع جسمك، الجذع مايل لقدام شوية.", "انزل ببطء لحد ما تحس بشد كويس في الصدر.", "ادفع لفوق لحد مد شبه كامل للذراع."],
    mistakes: ["جذع رأسي أوي بيحول الشغل للتراي بدل الصدر.", "نزول عميق جدًا من غير تحكم بيحمّل الكتف بشكل خطر."],
    tips: ["الميل لقدام بزاوية واضحة هو اللي بيفرق بين دبس صدر ودبس تراي.", "لو صعب، استخدم جهاز الـ Assisted Dip وقلل المساعدة تدريجيًا."],
    illustration: "https://musclewiki.com/exercise/parralel-bar-dips",
  }),
  ExDB({
    id: "decline-barbell-bench", en: "Decline Barbell Bench Press", ar: "بنش ديكلاين بار", group: "chest",
    primary: "Lower Chest", secondary: "Triceps, Front Delts", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["استلقي على بنش مايل لتحت، قدميك مثبتة في المسند.", "امسك البار ونزّله لأسفل الصدر بتحكم.", "ادفع لفوق لمد شبه كامل للذراع."],
    mistakes: ["نزول سريع من غير تحكم بسبب زاوية الميل.", "مدى حركة قصير خوفًا من فقدان توازن."],
    tips: ["الفرق عن الفلات في تفعيل أسفل الصدر بسيط نسبيًا حسب الدليل — استخدمه كتنويع مش كبديل أساسي.", "لو مفيش بنش هابط، جرب أطراف كيبل من فوق لتحت كبديل."],
    illustration: "https://www.muscleandstrength.com/exercises/decline-bench-press.html",
  }),
  ExDB({
    id: "smith-machine-bench-press", en: "Smith Machine Bench Press", ar: "بنش سميث مشين", group: "chest",
    primary: "Mid Chest", secondary: "Front Delts, Triceps", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اضبط البنش تحت البار في مسار السميث مشين.", "امسك البار وحل القفل، نزّله لمنتصف الصدر بتحكم.", "ادفع لفوق وقفل البار في نهاية السيت."],
    mistakes: ["وضع البنش في مكان غلط بيخلي مسار البار غير مريح للكتف.", "الاعتماد الكامل على المسار الثابت وإهمال ثبات الجذع."],
    tips: ["مسار البار الثابت بيسهّل زيادة الوزن تدريجيًا بأمان أكتر من البار الحر لحد ما تظبط فورمك.", "خيار كويس لو بتتمرن لوحدك من غير Spotter."],
    illustration: "https://musclewiki.com/exercise/smith-machine-bench-press",
  }),

  // ================= BACK =================
  // Ordered: vertical pulling (pull-up/lat pulldown family — strongest,
  // most consistent lat EMG evidence, builds width) → horizontal pulling
  // / rows (best evidence for mid-back thickness) → isolation/carry
  // variants → deadlift (huge posterior-chain compound, listed here as
  // the classic "back day" staple even though hamstrings/glutes share
  // a large part of the load).
  ExDB({
    id: "pullups", en: "Pull-ups", ar: "سحب علوي (عقلة)", group: "back",
    primary: "Lats", secondary: "Biceps, Rear Delts", equipment: "Bodyweight", difficulty: "Advanced",
    instructions: ["امسك البار بقبضة أعرض من الكتف شوية.", "اسحب جسمك لفوق لحد ما ذقنك يعدي البار.", "انزل بتحكم لمد كامل للذراع."],
    mistakes: ["نزول جزئي بس تحت (مش مادّ الذراع بالكامل).", "هز الجسم (Kipping) للمساعدة بدل السحب الفعلي."],
    tips: ["فكر إنك بتسحب بالكوع مش بالإيد.", "لو صعب، ابدأ بـ Assisted Pull-up أو Lat Pulldown."],
    illustration: "https://musclewiki.com/exercise/pull-ups",
  }),
  ExDB({
    id: "lat-pulldown", en: "Lat Pulldown", ar: "لات بولداون", group: "back",
    primary: "Lats", secondary: "Biceps, Rear Delts", equipment: "Machine", difficulty: "Beginner",
    instructions: ["امسك القبضة أعرض من الكتف واقعد ثابت.", "اسحب القبضة لأعلى الصدر مع فتح الصدر.", "ارجع ببطء لمد كامل للذراع."],
    mistakes: ["الميل للخلف بزاوية كبيرة والاعتماد على وزن الجسم بدل الظهر.", "سحب القبضة لخلف الرقبة (خطر على الكتف)."],
    tips: ["تخيل إنك بتقرب المرفق لجنب جسمك مش بتسحب بس بالإيد.", "بديل ممتاز لو الـ Pull-up لسه صعب عليك."],
    illustration: "https://musclewiki.com/exercise/cable-lat-pulldown",
  }),
  ExDB({
    id: "chin-up", en: "Chin-up", ar: "تشين أب", group: "back",
    primary: "Lats", secondary: "Biceps, Rear Delts", equipment: "Bodyweight", difficulty: "Advanced",
    instructions: ["امسك البار بقبضة عرض الكتف تقريبًا وكفوفك متجهة لوشك.", "اسحب جسمك لفوق لحد ما ذقنك يعدي البار.", "انزل بتحكم لمد كامل."],
    mistakes: ["نفس أخطاء الـ Pull-up: نزول جزئي وهز الجسم.", "استخدام قبضة أعرض من اللازم بيقلل مشاركة الباي."],
    tips: ["القبضة المعكوسة بتشغل الباي أكتر من الـ Pull-up العادي — تنويع كويس مش بديل.", "بديل مساعد: Assisted Chin-up أو Band-Assisted."],
    illustration: "https://musclewiki.com/exercise/chin-ups",
  }),
  ExDB({
    id: "chest-supported-row", en: "Chest-Supported Row", ar: "تشست سبورتد رو", group: "back",
    primary: "Mid Back", secondary: "Lats, Rear Delts, Biceps", equipment: "Machine", difficulty: "Intermediate",
    instructions: ["استلقي بصدرك على المسند المائل، امسك المقابض.", "اسحب لجنبك مع ضم لوحي الكتف من غير هز للجسم.", "ارجع ببطء لمد كامل."],
    mistakes: ["رفع الوش عن المسند أثناء السحب.", "استخدام وزن تقيل جدًا بيقصر مدى الحركة."],
    tips: ["السند على الصدر بيمنع هز الجسم تمامًا، فبتضمن إن الشغل كله على الظهر مش على الزخم — خيار ممتاز لو حاسس ضهرك السفلي بيتعب من التجديف العادي.", "ركز على سحب المرفق للخلف مش بس تقريب اليد."],
    illustration: "https://musclewiki.com/exercise/machine-chest-supported-t-bar-row",
  }),
  ExDB({
    id: "seated-cable-row", en: "Seated Cable Row", ar: "سيتد كيبل رو", group: "back",
    primary: "Mid Back", secondary: "Lats, Biceps", equipment: "Cable", difficulty: "Beginner",
    instructions: ["اقعد وركبتك مثنية خفيف، امسك القبضة وضهرك مستقيم.", "اسحب القبضة لبطنك مع ضم لوحي الكتف.", "ارجع ببطء من غير ما تسيب الوزن يشدك لقدام بسرعة."],
    mistakes: ["تقويس الظهر للخلف عند السحب للمساعدة.", "الميل لقدام كتير في مرحلة الرجوع."],
    tips: ["حافظ على جذع شبه ثابت — الحركة أساسًا من الذراع والظهر.", "وقفة خفيفة في نقطة الضم بتزود التفعيل."],
    illustration: "https://musclewiki.com/exercise/machine-seated-cable-row",
  }),
  ExDB({
    id: "bent-over-row", en: "Bent Over Row", ar: "بنت أوفر رو", group: "back",
    primary: "Mid Back", secondary: "Lats, Biceps, Rear Delts", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["امسك البار وانحني من الورك بزاوية حوالي 45°، الضهر مستقيم.", "اسحب البار لبطنك السفلي مع ضم لوحي الكتف.", "انزل بتحكم لمد كامل للذراع."],
    mistakes: ["تقويس أسفل الظهر أثناء السحب.", "استخدام هزة الجسم (Momentum) بدل شد الظهر."],
    tips: ["ثبت الحوض طول الحركة — الحركة من الكتف والمرفق بس.", "لو حاسس ضهرك بيشتغل زيادة، جرب Chest-Supported Row."],
    illustration: "https://musclewiki.com/exercise/barbell-bent-over-row",
  }),
  ExDB({
    id: "pendlay-row", en: "Pendlay Row", ar: "بندلاي رو", group: "back",
    primary: "Mid Back", secondary: "Lats, Biceps", equipment: "Barbell", difficulty: "Advanced",
    instructions: ["انحني لحد ما جذعك يبقى شبه موازي للأرض والبار على الأرض.", "اسحب البار بقوة لبطنك في حركة واحدة سريعة ومتحكم فيها.", "حط البار على الأرض تاني بين كل عدة (بداية جديدة كل مرة)."],
    mistakes: ["الوقوف شبه رأسي بدل الانحناء الكامل بيفرغ التمرين من هدفه.", "استخدام زخم الجسم كله بدل قوة الظهر."],
    tips: ["كل عدة بتبدأ من صفر (البار على الأرض) وده بيمنع الاعتماد على الارتداد — تمرين قوة وسمك ممتاز بس محتاج فورم دقيق.", "ابدأ بوزن أقل بكتير من التجديف العادي لحد ما تتقن الوضع."],
    illustration: "https://musclewiki.com/exercise/barbell-pronated-pendlay-row",
  }),
  ExDB({
    id: "t-bar-row", en: "T-Bar Row", ar: "تي بار رو", group: "back",
    primary: "Mid Back", secondary: "Lats, Biceps, Rear Delts", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["قف فوق البار وانحني من الورك، امسك المقبض بإيدين.", "اسحب لصدرك السفلي مع ضم لوحي الكتف.", "انزل بتحكم لمد شبه كامل."],
    mistakes: ["تقويس أسفل الظهر تحت حمل تقيل.", "مدى حركة قصير بسبب وزن زيادة عن قدرتك."],
    tips: ["قبضة أضيق بتشغل الظهر الأوسط أكتر، وأوسع بتشرك الكتف الخلفي أكتر.", "لو الجهاز المخصص مش متاح، ينفع تعمله بطرف بار عادي في الركن."],
    illustration: "https://musclewiki.com/exercise/landmine-t-bar-rows",
  }),
  ExDB({
    id: "single-arm-db-row", en: "Single-Arm Dumbbell Row", ar: "سينجل آرم دمبلز رو", group: "back",
    primary: "Lats", secondary: "Mid Back, Biceps", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["حط ركبة وإيد على البنش، الظهر مستقيم وموازي للأرض تقريبًا.", "اسحب الدمبلز لجنب حوضك مع سحب المرفق للخلف.", "انزل بتحكم لمد كامل."],
    mistakes: ["لف الجذع مع السحب بدل تثبيته.", "سحب الدمبلز لفوق بدل للخلف (بيقلل شغل اللاتس)."],
    tips: ["السند على البنش بيثبت الجذع تمامًا فبيخليك تركز الشغل كله على الظهر.", "مدى حركة كامل (نزول لحد مد الذراع بالكامل) بيدّي شد كويس في اللاتس أول كل عدة."],
    illustration: "https://musclewiki.com/exercise/dumbbell-single-arm-row",
  }),
  ExDB({
    id: "straight-arm-pulldown", en: "Straight-Arm Pulldown", ar: "ستريت آرم بولداون", group: "back",
    primary: "Lats", secondary: "—", equipment: "Cable", difficulty: "Beginner",
    instructions: ["قف قدام الكيبل العالي، امسك القبضة بذراع شبه مفرودة.", "ادفع الذراع لتحت لحد جنب فخذك مع ثبات المرفق.", "ارجع ببطء لفوق."],
    mistakes: ["ثني المرفق كتير بيحول الحركة لتراي بدل لاتس.", "استخدام الجسم كله (هز) للمساعدة في الدفع."],
    tips: ["تمرين عزل ممتاز للاتس من غير مشاركة كبيرة من الباي — كويس كإحماء قبل السحب التقيل أو كإضافة في نهاية التمرين.", "ركز على الشد في اللاتس مش على سرعة الحركة."],
    illustration: "https://www.muscleandstrength.com/exercises/straight-arm-lat-pull-down.html",
  }),
  ExDB({
    id: "inverted-row", en: "Inverted Row", ar: "إنفرتد رو", group: "back",
    primary: "Mid Back", secondary: "Lats, Biceps", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي تحت بار مثبت بارتفاع مناسب، امسكه بقبضة أعرض من الكتف.", "جسمك خط مستقيم من الكعب للراس.", "اسحب صدرك لفوق للبار مع ضم لوحي الكتف، وانزل بتحكم."],
    mistakes: ["سقوط الحوض لتحت أثناء السحب.", "مدى حركة قصير (مش وصّل صدرك للبار)."],
    tips: ["بديل بوزن الجسم ممتاز لمين لسه مش قادر يعمل Pull-up — زوّد الصعوبة بخفض ارتفاع البار.", "اشد البطن طول الحركة زي البلانك."],
    illustration: "https://musclewiki.com/exercise/inverted-row",
  }),
  ExDB({
    id: "conventional-deadlift", en: "Conventional Deadlift", ar: "كونفنشنال ديدليفت", group: "back",
    primary: "Erector Spinae (الظهر السفلي)", secondary: "Glutes, Hamstrings, Traps, Lats (ثبات)", equipment: "Barbell", difficulty: "Advanced",
    instructions: ["قف والبار قريب من قصبة رجلك، امسكه بقبضة عرض الكتف.", "اشد ظهرك مستقيم واكتافك فوق البار تقريبًا.", "ادفع بالأرض وارفع البار مع مد الورك والركبة سوا لحد الوقفة الكاملة.", "انزل بتحكم بعكس نفس المسار."],
    mistakes: ["تقويس أو تقعير الظهر تحت حمل تقيل (أخطر غلط في التمرين ده).", "رفع الحوض قبل الكتف (بيحول التمرين لـ Good Morning من غير قصد)."],
    tips: ["فكر إنك بتدفع الأرض بعيد بدل ما بتسحب البار لفوق.", "تمرين مركب ضخم بيشغل الظهر كله كثبات إضافة لسلسلة الورك الخلفية — يستاهل يتعلم بفورم صح قبل زيادة الوزن."],
    illustration: "https://musclewiki.com/exercise/barbell-deadlift",
  }),

  // ================= SHOULDERS =================
  // Ordered: overhead pressing (compound, largest total-shoulder loading
  // + evidence base) → lateral raise family (best isolated evidence for
  // side-delt hypertrophy specifically) → rear-delt work (usually
  // under-trained by pressing, important for shoulder health) → front
  // raise/upright row (popular but lower marginal value since front
  // delts are already loaded heavily by every press).
  ExDB({
    id: "barbell-overhead-press", en: "Barbell Overhead Press", ar: "أوفرهيد بريس بار", group: "shoulders",
    primary: "Front + Side Delts", secondary: "Triceps, Upper Chest", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["قف والبار على مستوى أعلى الصدر، قبضة عرض الكتف تقريبًا.", "اشد البطن والجلوت (منع تقوس الظهر).", "ادفع البار فوق راسك في خط مستقيم لحد مد الذراع."],
    mistakes: ["تقويس أسفل الظهر بشدة أثناء الدفع.", "دفع البار لقدام بدل فوق مباشرة."],
    tips: ["الحركة المركبة الأكتر توثيقًا لبناء قوة وحجم الكتف ككل.", "لو صعب تحافظ على التوازن واقف، ابدأ بالنسخة القاعدة."],
    illustration: "https://musclewiki.com/exercise/barbell-overhead-press",
  }),
  ExDB({
    id: "db-shoulder-press", en: "DB Shoulder Press", ar: "دمبلز شولدر بريس", group: "shoulders",
    primary: "Front + Side Delts", secondary: "Triceps", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["امسك دمبلز في كل إيد بمستوى الكتف.", "اشد الكور قبل ما تدفع فوق.", "ادفع الدمبلز فوق لحد مد الذراع من غير قفل كامل."],
    mistakes: ["تقويس أسفل الظهر للمساعدة في الدفع.", "الدمبلز بتتحرك قدام خط الكتف بدل فوقه مباشرة."],
    tips: ["زفير أثناء الدفع، شهيق أثناء النزول.", "لو حاسس ضهرك بيشتغل، جرب Seated DB Press بمساندة."],
    illustration: "https://musclewiki.com/exercise/dumbbell-overhead-press",
  }),
  ExDB({
    id: "seated-db-press", en: "Seated DB Press", ar: "سيتد دمبلز بريس", group: "shoulders",
    primary: "Front + Side Delts", secondary: "Triceps", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["اقعد على بنش بظهر مسند، امسك دمبلز بمستوى الكتف.", "ادفع فوق لحد مد شبه كامل للذراع.", "انزل بتحكم."],
    mistakes: ["ابعاد الدمبلز عن خط الجسم أوي أثناء الدفع.", "إسناد الرقبة بدل أعلى الظهر على المسند."],
    tips: ["إسناد الظهر بيلغي أي مساعدة من الأرجل أو تقوس الظهر — تركيز أنقى على الكتف من النسخة الواقفة.", "خيار كويس لو عندك أي حساسية في أسفل الظهر."],
    illustration: "https://musclewiki.com/exercise/dumbbell-seated-overhead-press",
  }),
  ExDB({
    id: "lateral-raise", en: "Lateral Raise", ar: "لاترال ريز", group: "shoulders",
    primary: "Side Delts", secondary: "Traps", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبلز خفيف في كل إيد جنب جسمك.", "ارفع الذراعين للجانب لحد مستوى الكتف تقريبًا.", "انزل ببطء وتحكم."],
    mistakes: ["استخدام وزن تقيل بيخلي الترابيس يشتغل بدل الكتف الجانبي.", "الرفع لفوق مستوى الكتف بشكل مبالغ فيه."],
    tips: ["مرفق مرفوع شوية عن مستوى اليد وقت الرفع.", "زود العدات لـ20 قبل ما تزود الوزن."],
    illustration: "https://musclewiki.com/exercise/dumbbell-lateral-raise",
  }),
  ExDB({
    id: "cable-lateral-raise", en: "Cable Lateral Raise", ar: "كيبل لاترال ريز", group: "shoulders",
    primary: "Side Delts", secondary: "Traps", equipment: "Cable", difficulty: "Beginner",
    instructions: ["اضبط البكرة لأسفل، قف جنبها والكيبل عابر قدام جسمك.", "ارفع الذراع للجانب لحد مستوى الكتف.", "انزل ببطء."],
    mistakes: ["الميل بالجذع بعيد عن البكرة للمساعدة في الرفع.", "سرعة زيادة تفقد التحكم في النزول."],
    tips: ["الكيبل بيدي شد مستمر على العضلة من أول لآخر الحركة، بعكس الدمبلز اللي شده بيقل في القمة — تنويع مفيد جنب الرفرفة العادية.", "اعمل الجانبين لوحدهم أو بترتيب متبادل."],
    illustration: "https://www.muscleandstrength.com/exercises/two-arm-cable-lateral-raise.html",
  }),
  ExDB({
    id: "face-pull", en: "Face Pull", ar: "فيس بول", group: "shoulders",
    primary: "Rear Delts", secondary: "الظهر العلوي", equipment: "Cable", difficulty: "Beginner",
    instructions: ["اضبط البكرة عند مستوى الوش تقريبًا.", "امسك الحبل واسحب لوشك مع فتح المرفقين للخارج.", "ارجع ببطء."],
    mistakes: ["السحب لأسفل بدل لمستوى الوش بيقلل شغل الـ Rear Delts.", "استخدام وزن تقيل بيخلي الحركة تعتمد على الجسم كله."],
    tips: ["تمرين ممتاز لموازنة تمارين الدفع وحماية صحة الكتف.", "ركز على ضم لوحي الكتف في نهاية السحب."],
    illustration: "https://musclewiki.com/exercise/machine-face-pulls",
  }),
  ExDB({
    id: "reverse-pec-deck", en: "Reverse Pec Deck", ar: "ريفرس فراشة", group: "shoulders",
    primary: "Rear Delts", secondary: "الظهر العلوي", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد ووشك للمسند، امسك المقابض قدامك.", "افتح الذراعين للخلف والجانبين لحد شبه خط الكتف.", "ارجع ببطء."],
    mistakes: ["استخدام وزن تقيل بيقصر مدى الحركة.", "هز الجذع للمساعدة في الفتح."],
    tips: ["بديل ثابت للفيس بول، سهل التحكم في مدى الحركة والتفعيل.", "ركز على عصر لوحي الكتف في نهاية الفتح."],
    illustration: "https://musclewiki.com/exercise/machine-reverse-fly",
  }),
  ExDB({
    id: "front-raise", en: "Front Raise", ar: "فرونت ريز", group: "shoulders",
    primary: "Front Delts", secondary: "Upper Chest", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبلز في كل إيد قدام فخذك.", "ارفع دمبلز واحد (أو الاتنين) لمستوى الكتف قدامك.", "انزل ببطء وابدل."],
    mistakes: ["هز الجسم للمساعدة في الرفع.", "الرفع لفوق مستوى الكتف بيحمّل المفصل من غير فايدة إضافية."],
    tips: ["استخدم وزن خفيف نسبيًا — العضلة صغيرة وسهل تتعب، وأصلًا بتشتغل كتير في أي تمرين بريس.", "خلي المرفق فيه انحناءة خفيفة طول الحركة."],
    illustration: "https://musclewiki.com/exercise/dumbbell-front-raise",
  }),
  ExDB({
    id: "arnold-press", en: "Arnold Press", ar: "بريس أرنولد", group: "shoulders",
    primary: "Front + Side Delts", secondary: "Triceps", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["امسك دمبلز قدام كتفك، الكف متجهة لجسمك.", "ادفع فوق مع لف الرسغ لحد ما الكف يبقى لقدام في القمة.", "ارجع بنفس مسار اللف."],
    mistakes: ["لف سريع أوي بيحمّل مفصل الكتف بلا داعي.", "استخدام وزن تقيل جدًا بيبوظ مسار اللف."],
    tips: ["حركة اللف بتضيف شغل إضافي بسيط على الكتف الأمامي والجانبي مقارنة بالبريس العادي — تنويع ممتع مش بديل أساسي.", "ابدأ بوزن أخف من بريس الكتف العادي."],
    illustration: "https://musclewiki.com/exercise/dumbbell-arnold-press",
  }),
  ExDB({
    id: "upright-row", en: "Upright Row", ar: "أبرايت رو", group: "shoulders",
    primary: "Side Delts", secondary: "Traps", equipment: "Cable", difficulty: "Intermediate",
    instructions: ["امسك القبضة أو البار بقبضة عرض الكتف تقريبًا.", "اسحب فوق لحد مستوى الصدر مع المرفقين لفوق وللجانب.", "انزل بتحكم."],
    mistakes: ["قبضة ضيقة أوي مع سحب عالي جدًا ممكن يضغط على مفصل الكتف — لو حسيت أي ألم في المفصل وقف واستخدم قبضة أوسع أو ارفع لمدى أقل.", "استخدام وزن تقيل بيقصر مدى الحركة."],
    tips: ["قبضة أوسع من عرض الكتف بتقلل الضغط على المفصل مقارنة بالقبضة الضيقة.", "تمرين شائع ومفيد للكتف الجانبي والترابيس، بس محتاج انتباه للفورم أكتر من غيره."],
    illustration: "https://musclewiki.com/exercise/cable-upright-row",
  }),

  // ================= BICEPS =================
  // Ordered: barbell/EZ-bar curls (most-loaded, most-researched baseline)
  // → incline DB curl (stretch-position emphasis, growing evidence for
  // long-length training) → standard DB curl → cable curl (constant
  // tension) → preacher/concentration (strict isolation, momentum-free).
  ExDB({
    id: "barbell-curl", en: "Barbell Curl", ar: "باي بار", group: "biceps",
    primary: "Biceps", secondary: "Forearms", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["امسك البار بقبضة عرض الكتف، الذراعين جنب جسمك.", "اثني المرفق وارفع البار لفوق من غير هز.", "انزل بتحكم لمد كامل."],
    mistakes: ["هز الجسم واستخدام الظهر لدفع البار (Cheat Curl).", "تحريك المرفق لقدام أثناء الرفع."],
    tips: ["الحركة الأساسية الأكتر شيوعًا وتحميلًا للباي — تقدر تزود عليها وزن بثبات مع الوقت.", "لو حاسس ضغط في الرسغ، جرب EZ-Bar بدل البار المستقيم."],
    illustration: "https://musclewiki.com/exercise/barbell-curl",
  }),
  ExDB({
    id: "ez-bar-curl", en: "EZ-Bar Curl", ar: "باي بار EZ", group: "biceps",
    primary: "Biceps", secondary: "Forearms", equipment: "Barbell", difficulty: "Beginner",
    instructions: ["امسك البار المموج من المسكة المائلة.", "اثني المرفق وارفع لفوق.", "انزل بتحكم."],
    mistakes: ["نفس أخطاء باي البار: هز الجسم وتحريك المرفق.", "قبضة أعرض أو أضيق من الوضع المريح للرسغ."],
    tips: ["الشكل المموج للبار بيريح الرسغ أكتر من البار المستقيم — بديل عملي لمين عنده حساسية في المعصم.", "خيار شائع جدًا في أغلب الجيمات."],
    illustration: "https://musclewiki.com/exercise/ez-bar-curl",
  }),
  ExDB({
    id: "incline-db-curl", en: "Incline DB Curl", ar: "إنكلاين باي دمبلز", group: "biceps",
    primary: "Biceps (Long Head)", secondary: "Forearms", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["استلقي على بنش مايل لفوق (45-60°)، ذراعيك نازلة جنب جسمك.", "اثني المرفق وارفع الدمبلز من غير ما تدفع كتفك لقدام.", "انزل ببطء لحد مد كامل للذراع للخلف."],
    mistakes: ["دفع الكتف لقدام أثناء الرفع (بيقلل الإطالة المطلوبة).", "استخدام وزن تقيل جدًا بيمنعك من مد الذراع بالكامل تحت."],
    tips: ["وضع الذراع خلف خط الجسم بيمد الراس الطويلة أكتر من الباي العادي — تمرين مدعوم بأبحاث حديثة على أهمية التدريب في وضع الإطالة.", "استخدم وزن أخف من الباي الواقف لحد ما تعتاد المدى الأوسع."],
    illustration: "https://musclewiki.com/exercise/dumbbell-incline-curl",
  }),
  ExDB({
    id: "db-curl-alternating", en: "Alternating Dumbbell Curl", ar: "باي دمبلز ألترنيتينج", group: "biceps",
    primary: "Biceps", secondary: "Forearms", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبلز في كل إيد جنب جسمك.", "اثني إيد واحدة وارفعها لفوق، ممكن تلف الرسغ للخارج شوية.", "انزل وابدل الإيد التانية."],
    mistakes: ["هز الكتف أو الجسم للمساعدة.", "تحريك المرفق بعيد عن الجسم."],
    tips: ["التبديل بين الإيدين بيسمح بتركيز أعلى على كل جانب لوحده.", "من أبسط وأشيع تمارين الباي وسهل تتحكم فيه بأي وزن."],
    illustration: "https://www.muscleandstrength.com/exercises/alternating-standing-dumbbell-curl.html",
  }),
  ExDB({
    id: "cable-curl", en: "Cable Curl", ar: "باي كيبل", group: "biceps",
    primary: "Biceps", secondary: "Forearms", equipment: "Cable", difficulty: "Beginner",
    instructions: ["امسك القبضة والمرفق ثابت جنب جسمك.", "اثني المرفق وارفع القبضة لفوق.", "انزل بتحكم لمد كامل."],
    mistakes: ["هز الجسم (Cheat Curl) للمساعدة في الرفع.", "تحريك المرفق لقدام أثناء الرفع."],
    tips: ["الشد الثابت من الكيبل بيدي تحفيز أعلى من الدمبلز في نفس العدد.", "تحكم في النزول، متسيبش الوزن يسقط."],
    illustration: "https://musclewiki.com/exercise/cable-bar-curl",
  }),
  ExDB({
    id: "preacher-curl", en: "Preacher Curl", ar: "باي بريتشر", group: "biceps",
    primary: "Biceps", secondary: "Forearms", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["اقعد وضع صدرك/ذراعك الخلفية على المسند المائل.", "اثني المرفق وارفع الوزن لفوق.", "انزل ببطء من غير ما تمد المرفق بعنف."],
    mistakes: ["مد المرفق بالكامل بسرعة تحت وزن تقيل (ضغط على المفصل).", "رفع الكتف عن المسند للمساعدة."],
    tips: ["المسند بيمنع أي هز للجسم تمامًا، فبيضمن إن الشغل كله على الباي — ممتاز لمين بيميل يغش في الفورم.", "استخدم وزن أقل من الباي الواقف؛ الوضعية دي أصعب ميكانيكيًا."],
    illustration: "https://www.muscleandstrength.com/exercises/preacher-curl.html",
  }),
  ExDB({
    id: "hammer-curl", en: "Hammer Curl", ar: "باي هامر", group: "biceps",
    primary: "Biceps + Brachialis", secondary: "Forearms", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبلز بقبضة محايدة (الإبهام لفوق) جنب جسمك.", "اثني المرفق وارفع الدمبلز لفوق من غير تدوير الرسغ.", "انزل بتحكم."],
    mistakes: ["هز الكتف أو الجسم للمساعدة في الرفع.", "تحريك المرفق بعيد عن الجسم."],
    tips: ["القبضة المحايدة بتشغّل الساعد بشكل أكبر من الباي العادي.", "ثبت المرفق جنب جسمك طول الحركة."],
    illustration: "https://musclewiki.com/exercise/dumbbell-hammer-curl",
  }),
  ExDB({
    id: "concentration-curl", en: "Concentration Curl", ar: "باي كونسنتريشن", group: "biceps",
    primary: "Biceps", secondary: "Forearms", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["اقعد وحط مرفقك على جوه فخذك، انحني شوية لقدام.", "اثني المرفق وارفع الدمبلز لفوق.", "انزل ببطء."],
    mistakes: ["تحريك المرفق عن الفخذ أثناء الرفع.", "استخدام وزن تقيل بيمنع مدى الحركة الكامل."],
    tips: ["ثبات المرفق الكامل بيخليه تمرين ممتاز للتركيز الذهني على العضلة (Mind-Muscle Connection) خصوصًا في آخر التمرين.", "وزن خفيف نسبيًا كفاية — الهدف هنا الإحساس بالعضلة مش رفع وزن تقيل."],
    illustration: "https://musclewiki.com/exercise/dumbbell-concentration-curl",
  }),

  // ================= TRICEPS =================
  // Ordered: overhead extension (best current evidence for long-head
  // growth — trains it at its longest length) → close-grip bench
  // (heaviest compound, biggest overload capacity) → pushdown (most
  // practical/popular staple) → skull crushers → overhead DB / dips /
  // bodyweight/isolation finishers.
  ExDB({
    id: "overhead-cable-triceps-extension", en: "Overhead Cable Triceps Extension", ar: "تراي كيبل أوفرهيد", group: "triceps",
    primary: "Triceps (Long Head)", secondary: "—", equipment: "Cable", difficulty: "Intermediate",
    instructions: ["قف ووشك بعيد عن البكرة، امسك الحبل وارفع ذراعيك فوق راسك.", "نزّل الحبل خلف راسك بثني المرفق.", "ادفع لفوق لمد كامل تقريبًا."],
    mistakes: ["فتح المرفقين للجانبين بدل تثبيتهم قدام الراس.", "مدى حركة قصير خوفًا من ضرب الراس."],
    tips: ["وضع الذراع فوق الراس بيمد الراس الطويلة للتراي بالكامل، وده مرتبط في أبحاث حديثة بنمو أكبر مقارنة بالبوش داون العادي — يستاهل يكون من أول تمارين يوم التراي مش آخرها.", "ابدأ بوزن أخف من البوش داون؛ الوضعية دي أصعب."],
    illustration: "https://musclewiki.com/exercise/cable-rope-overhead-tricep-extension",
  }),
  ExDB({
    id: "close-grip-bench-press", en: "Close-Grip Bench Press", ar: "كلوز جريب بنش", group: "triceps",
    primary: "Triceps", secondary: "Chest, Front Delts", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["استلقي على البنش، امسك البار بقبضة عرض الكتف تقريبًا (أضيق من بنش الصدر العادي).", "نزّل البار لأسفل الصدر، المرفقين قريبين من جسمك.", "ادفع لفوق لمد كامل."],
    mistakes: ["قبضة ضيقة جدًا بتحمّل الرسغ والمرفق بشكل غير مريح.", "فتح المرفقين للجانبين زي بنش الصدر العادي."],
    tips: ["تمرين مركب بيسمح بأتقل وزن ممكن تحمّل بيه التراي — ممتاز لبناء القوة والحجم مع بعض.", "قبضة عرض الكتف تقريبًا (مش ضيقة أوي) بتوازن بين شغل التراي والراحة."],
    illustration: "https://musclewiki.com/exercise/barbell-close-grip-bench-press",
  }),
  ExDB({
    id: "tricep-pushdown", en: "Tricep Pushdown", ar: "تراي كيبل", group: "triceps",
    primary: "Triceps", secondary: "—", equipment: "Cable", difficulty: "Beginner",
    instructions: ["امسك القبضة والمرفق ثابت جنب جسمك.", "ادفع القبضة لتحت لحد مد كامل للذراع.", "ارجع ببطء."],
    mistakes: ["فتح المرفق للخارج بيقلل تفعيل الترايسبس ويحمّل الكتف.", "استخدام الجسم كله (ميل لقدام) للمساعدة في الدفع."],
    tips: ["ثبت المرفق طول الحركة — الحركة من الساعد بس.", "لتنويع، جرب Overhead Tricep Extension."],
    illustration: "https://musclewiki.com/exercise/cable-rope-pushdown",
  }),
  ExDB({
    id: "skull-crushers", en: "Skull Crushers (Lying Triceps Extension)", ar: "سكل كراشر", group: "triceps",
    primary: "Triceps", secondary: "—", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["استلقي على البنش، امسك البار (أو الدمبلز) فوق صدرك بذراع مفرودة.", "اثني المرفق ونزّل الوزن لجنب/خلف راسك.", "ادفع لفوق لمد كامل من غير قفل عنيف."],
    mistakes: ["تحريك المرفق لقدام أو للخلف بدل ثباته فوق الكتف.", "نزول الوزن على الراس أو الرقبة بدل جنبها."],
    tips: ["اسم التمرين مخيف بس لو المرفق ثابت التمرين آمن وفعال جدًا للراسين الجانبي والوسطي.", "استخدم EZ-Bar بدل البار المستقيم لراحة أكبر في الرسغ."],
    illustration: "https://musclewiki.com/exercise/barbell-skullcrusher",
  }),
  ExDB({
    id: "overhead-db-extension", en: "Overhead DB Extension", ar: "تراي دمبلز أوفرهيد", group: "triceps",
    primary: "Triceps (Long Head)", secondary: "—", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["اقعد أو قف، امسك دمبلز واحد بإيدين فوق راسك.", "نزّل الدمبلز خلف راسك بثني المرفقين.", "ادفع لفوق لمد كامل."],
    mistakes: ["فتح المرفقين للجانبين بدل تثبيتهم لفوق.", "نزول سريع من غير تحكم قريب من الرقبة."],
    tips: ["بديل بسيط للنسخة بالكيبل لو الجيم زحمة أو الكيبل مشغول.", "ينفع كمان بإيد واحدة لتمرين أحادي الجانب."],
    illustration: "https://musclewiki.com/exercise/dumbbell-overhead-tricep-extension",
  }),
  ExDB({
    id: "dips", en: "Dips (Assisted)", ar: "تراي دبس", group: "triceps",
    primary: "Triceps", secondary: "صدر سفلي", equipment: "Machine", difficulty: "Advanced",
    instructions: ["امسك المقابض وجسمك مستقيم تقريبًا.", "انزل بثني المرفقين لحد زاوية 90° تقريبًا.", "ادفع لفوق لحد مد كامل للذراع."],
    mistakes: ["ميل الجذع لقدام بشكل زيادة بيحول التمرين لصدر بدل تراي.", "النزول العميق أوي من غير تحكم بيحمّل الكتف."],
    tips: ["قلل المساعدة تدريجيًا لحد ما تعمله بوزن جسمك.", "بديل أسهل: Bench Dips أو Tricep Pushdown."],
    illustration: "https://musclewiki.com/exercise/machine-assisted-parallel-bar-dips",
  }),
  ExDB({
    id: "diamond-pushup", en: "Diamond Push-up", ar: "ضغط دايموند", group: "triceps",
    primary: "Triceps", secondary: "Chest", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["ابدأ في وضع بلانك، الإيدين تحت الصدر وقريبين من بعض (شكل ماسة بالإبهام والسبابة).", "انزل صدرك لحد ما يقرب من الإيدين.", "ادفع لفوق لمد كامل."],
    mistakes: ["فتح المرفقين للجانبين بدل قربهم من الجسم.", "سقوط الحوض لتحت زي أي ضغط عادي."],
    tips: ["بديل بوزن الجسم بالكامل لو مفيش معدات — أصعب من الضغط العادي فابدأ على الركب لو محتاج.", "اشد البطن طول الحركة."],
    illustration: "https://musclewiki.com/exercise/diamond-push-ups",
  }),
  ExDB({
    id: "triceps-kickback", en: "Triceps Kickback", ar: "كيك باك تراي", group: "triceps",
    primary: "Triceps", secondary: "—", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["انحني بجذعك لقدام، المرفق مثني بمستوى جسمك.", "مد الذراع للخلف لحد استقامة كاملة.", "ارجع ببطء."],
    mistakes: ["استخدام وزن تقيل يمنعك من مد الذراع بالكامل.", "تحريك المرفق أثناء المد بدل تثبيته."],
    tips: ["التفعيل الأعلى في التمرين ده بيكون في آخر الحركة (المد الكامل)، فوزن خفيف مع تركيز على القمة أفضل من وزن تقيل بمدى ناقص.", "تمرين شائع جدًا كخاتمة ليوم التراي."],
    illustration: "https://musclewiki.com/exercise/dumbbell-tricep-kickback",
  }),

  // ================= FOREARMS =================
  // Evidence here is thinner than the larger muscle groups — mostly
  // biomechanical/EMG rationale and practical/grip-sport experience
  // rather than large hypertrophy RCTs. All options are common and
  // roughly interchangeable; order follows practicality/progressive
  // overload more than a strong evidence hierarchy.
  ExDB({
    id: "barbell-wrist-curl", en: "Barbell Wrist Curl", ar: "ريست كيرل بار", group: "forearms",
    primary: "Forearm Flexors", secondary: "—", equipment: "Barbell", difficulty: "Beginner",
    instructions: ["اقعد وساعدك على فخذك أو حرف بنش، الرسغ برة الحرف.", "امسك البار وانزّل الرسغ لتحت.", "ارفع الرسغ لفوق قد ما تقدر."],
    mistakes: ["تحريك الساعد كله بدل الرسغ بس.", "استخدام وزن تقيل بيقصر مدى الحركة."],
    tips: ["مدى حركة صغير — ركز على الإحساس بالعضلة مش على الوزن.", "ينفع تعمله بدمبلز لو مفيش بار متاح."],
    illustration: "https://musclewiki.com/exercise/barbell-wrist-curl",
  }),
  ExDB({
    id: "barbell-reverse-wrist-curl", en: "Barbell Reverse Wrist Curl", ar: "ريفرس ريست كيرل بار", group: "forearms",
    primary: "Forearm Extensors", secondary: "—", equipment: "Barbell", difficulty: "Beginner",
    instructions: ["اقعد وساعدك على فخذك، كف إيدك لتحت.", "امسك البار وارفع الرسغ لفوق.", "انزل بتحكم."],
    mistakes: ["استخدام وزن تقيل جدًا (عضلات الإكستنسرز أضعف من الفليكسرز عادة).", "تحريك الساعد كله بدل الرسغ."],
    tips: ["مهم لتوازن قوة الرسغ (مش بس الفليكسرز) وتقليل خطر إجهاد الكوع من تمارين الباي/القبضة الكتيرة.", "ابدأ بوزن خفيف جدًا مقارنة بلف الرسغ العادي."],
    illustration: "https://www.muscleandstrength.com/exercises/reverse-barbell-wrist-curl.html",
  }),
  ExDB({
    id: "reverse-curl", en: "Reverse Curl", ar: "ريفرس كيرل", group: "forearms",
    primary: "Forearm Extensors + Brachioradialis", secondary: "Biceps", equipment: "Barbell", difficulty: "Beginner",
    instructions: ["امسك البار بقبضة معكوسة (الكفوف لتحت).", "اثني المرفق وارفع البار لفوق.", "انزل بتحكم."],
    mistakes: ["هز الجسم للمساعدة.", "استخدام وزن تقيل بيصعب الحفاظ على القبضة المعكوسة."],
    tips: ["القبضة المعكوسة بتشغل الساعد والـ Brachioradialis بشكل مختلف عن الباي العادي.", "استخدم وزن أخف بكتير من باي البار العادي."],
    illustration: "https://musclewiki.com/exercise/barbell/male/biceps/barbell-reverse-curl",
  }),
  ExDB({
    id: "zottman-curl", en: "Zottman Curl", ar: "باي زوتمان", group: "forearms",
    primary: "Forearms + Biceps", secondary: "—", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["امسك دمبلز بقبضة عادية وارفع زي الباي العادي.", "في القمة، لف الرسغ لحد ما الكف يبقى لتحت.", "انزل بالقبضة المعكوسة دي ببطء، ثم ارجع للقبضة العادية تحت."],
    mistakes: ["اللف بسرعة بدل بطء وتحكم.", "استخدام وزن تقيل بيصعب مرحلة اللف."],
    tips: ["بيجمع بين رفع عادي للباي ونزول معكوس للساعد في تمرين واحد — كفاءة عالية لوقت محدود.", "ركز على مرحلة النزول البطيئة، هي الأهم للساعد هنا."],
    illustration: "https://musclewiki.com/exercise/dumbbell-zottman-curl",
  }),
  ExDB({
    id: "cable-wrist-curl", en: "Cable Wrist Curl", ar: "ريست كيرل كيبل", group: "forearms",
    primary: "Forearm Flexors", secondary: "—", equipment: "Cable", difficulty: "Beginner",
    instructions: ["اقعد قدام البكرة السفلية، ساعدك على فخذك.", "امسك القبضة وانزّل ثم ارفع الرسغ.", "كرر بتحكم."],
    mistakes: ["تحريك الساعد كله بدل الرسغ بس.", "سرعة زيادة بدل حركة متحكم فيها."],
    tips: ["شد الكيبل المستمر بيدي تحفيز مختلف شوية عن البار/الدمبلز.", "بديل كويس لو مزاحم على البار في الجيم."],
    illustration: "https://musclewiki.com/exercise/cable-wrist-curl",
  }),
  ExDB({
    id: "dead-hang", en: "Dead Hang", ar: "ديد هانج", group: "forearms",
    primary: "Forearms (Grip)", secondary: "Lats (ثبات)", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["امسك بار العقلة بقبضة عرض الكتف.", "اترك جسمك معلق بالكامل، الكتف بعيد عن الودنين.", "استمر قد ما تقدر بقبضة ثابتة."],
    mistakes: ["رفع الكتف لحد الودنين (بيشيل الشغل عن اللاتس والساعد).", "التوقف بدري قبل ما القبضة تضعف فعليًا."],
    tips: ["أبسط تمرين لقوة القبضة وتحمّل الساعد، ومفيد كمان لتحرك الكتف — مفيش معدات مطلوبة غير بار.", "زوّد المدة تدريجيًا زي أي تمرين تحمّل ثابت."],
    illustration: "https://musclewiki.com/exercise/dead-hang",
  }),

  // ================= QUADS =================
  // Ordered: back squat (largest total loading + evidence base for
  // overall quad/leg mass) → leg press (comparable hypertrophy per
  // meta-analyses, safer overload) → hack squat / front squat (higher
  // relative quad emphasis due to more upright torso) → leg extension
  // (best isolated evidence for direct quad activation, esp. rectus
  // femoris) → beginner-friendly squat variations → single-leg/advanced.
  ExDB({
    id: "back-squat", en: "Back Squat", ar: "باك سكوات", group: "quads",
    primary: "Quads", secondary: "Glutes, Hamstrings", equipment: "Barbell", difficulty: "Advanced",
    instructions: ["حط البار على الترابيس العلوي، القدمين عرض الكتف.", "انزل بالورك للخلف وتحت، الركبتين لبره على خط القدم.", "ادفع بكعبك لفوق لحد الوقفة الكاملة."],
    mistakes: ["الركبتين بيتقفلوا لجوه أثناء النزول أو الصعود.", "رفع الكعب عن الأرض أثناء الحركة."],
    tips: ["نزول كامل بفورم مظبوط أفضل من نزول جزئي بوزن أتقل.", "زفير أثناء الدفع لفوق."],
    illustration: "https://musclewiki.com/exercise/barbell-squat",
  }),
  ExDB({
    id: "leg-press", en: "Leg Press", ar: "ليج بريس", group: "quads",
    primary: "Quads", secondary: "Glutes", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد في الجهاز والقدمين عرض الكتف على اللوح.", "افك القفل وانزل اللوح لحد زاوية 90° في الركبة.", "ادفع اللوح لفوق من غير قفل كامل للركبة."],
    mistakes: ["قفل الركبة بالكامل فوق (يحمّل المفصل من غير فايدة).", "رفع أسفل الظهر عن المقعد أثناء النزول العميق."],
    tips: ["بديل جيد للسكوات لو فيه إجهاد في أسفل الظهر — أبحاث حديثة بتوريه بيدّي نمو مشابه للسكوات لما يتعمل بمدى حركة كامل.", "تحكم في مرحلة النزول، متسيبش الوزن يسقط."],
    illustration: "https://musclewiki.com/exercise/machine-leg-press",
  }),
  ExDB({
    id: "hack-squat", en: "Hack Squat (Machine)", ar: "هاك سكوات", group: "quads",
    primary: "Quads", secondary: "Glutes", equipment: "Machine", difficulty: "Intermediate",
    instructions: ["حط ضهرك على المسند المائل، القدمين عرض الكتف على اللوح.", "افك القفل وانزل لحد زاوية 90° تقريبًا.", "ادفع لفوق من غير قفل كامل للركبة."],
    mistakes: ["نزول عميق جدًا مع رفع الكعب عن اللوح.", "وضع القدم عالي جدًا أو واطي جدًا على اللوح بيغير توزيع الحمل."],
    tips: ["مسار الحركة الثابت بيدّي تحميل تقيل وآمن نسبيًا للكوادز من غير تعقيد توازن السكوات الحر.", "وضع القدم في نص اللوح تقريبًا بيدّي توازن كويس بين الكوادز والجلوت."],
    illustration: "https://musclewiki.com/exercise/machine-hack-squat",
  }),
  ExDB({
    id: "front-squat", en: "Front Squat", ar: "فرونت سكوات", group: "quads",
    primary: "Quads", secondary: "Glutes, Core", equipment: "Barbell", difficulty: "Advanced",
    instructions: ["حط البار على مقدمة الكتف، المرفقين لفوق.", "انزل بجذع أقرب للرأسي من السكوات الخلفي.", "ادفع لفوق لحد الوقفة الكاملة."],
    mistakes: ["نزول المرفقين بيخلي البار يميل ويقع.", "الميل لقدام بشكل زيادة زي السكوات الخلفي."],
    tips: ["الوضع الأقرب للرأسي بيزود نسبة الشغل على الكوادز مقارنة بالسكوات الخلفي.", "محتاج مرونة كتف ورسغ كويسة — لو صعبة، جرب حمل البار بقبضة متقاطعة."],
    illustration: "https://www.muscleandstrength.com/exercises/front-squat.html",
  }),
  ExDB({
    id: "leg-extension", en: "Leg Extension (Machine)", ar: "ليج إكستنشن", group: "quads",
    primary: "Quads (خصوصًا Rectus Femoris)", secondary: "—", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد في الجهاز، الوسادة فوق الكاحل مباشرة.", "مد الركبة لحد استقامة شبه كاملة.", "انزل ببطء لحد بداية الحركة."],
    mistakes: ["استخدام زخم (رفعة سريعة) بدل حركة متحكم فيها.", "قفل الركبة بعنف في القمة."],
    tips: ["أعلى تفعيل مباشر ومعزول للكوادز من أي تمرين تاني لأنه معزول تمامًا عن الجلوت والهامسترينج — ممتاز كإضافة عزل بعد السكوات/الليج بريس مش كبديل عنهم.", "وقفة نص ثانية في القمة بتزود التفعيل."],
    illustration: "https://musclewiki.com/exercise/machine-leg-extension",
  }),
  ExDB({
    id: "goblet-squat", en: "Goblet Squat", ar: "سكوات جوبلت", group: "quads",
    primary: "Quads", secondary: "Glutes, Core", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبلز أو كيتل بيل قدام صدرك بإيدين.", "انزل بالورك للخلف وتحت مع صدر مرفوع.", "ادفع لفوق لحد الوقفة الكاملة."],
    mistakes: ["الميل لقدام بشكل زيادة بسبب ثقل قدام الجسم.", "رفع الكعب عن الأرض."],
    tips: ["أسهل تنويعة لتعلم فورم السكوات الصح قبل الانتقال للبار على الضهر.", "الوزن قدام الجسم بيساعدك توصل لعمق نزول أكبر بسهولة."],
    illustration: "https://musclewiki.com/exercise/dumbbell-goblet-squat",
  }),
  ExDB({
    id: "smith-machine-squat", en: "Smith Machine Squat", ar: "سكوات سميث مشين", group: "quads",
    primary: "Quads", secondary: "Glutes", equipment: "Machine", difficulty: "Beginner",
    instructions: ["حط البار على الترابيس العلوي داخل مسار السميث مشين.", "افك القفل وانزل بالورك للخلف وتحت.", "ادفع لفوق."],
    mistakes: ["الوقوف بعيد جدًا عن خط البار (المسار الثابت مش زي البار الحر).", "الاعتماد على المسار الثابت وإهمال ثبات الجذع."],
    tips: ["مسار ثابت بيقلل الحاجة للتوازن، خيار كويس للمبتدئين أو للتمرين من غير Spotter.", "جرب تحط قدمك شوية قدام خط البار عشان مسار الحركة يبقى مريح أكتر."],
    illustration: "https://musclewiki.com/exercise/smith-machine-squat",
  }),
  ExDB({
    id: "split-squat", en: "Stationary Split Squat", ar: "ستيشنري سبليت سكوات", group: "quads",
    primary: "Quads", secondary: "Glutes", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["قف بخطوة واسعة، رجل قدام ورجل خلف من غير رفع الرجل الخلفية.", "انزل لحد ما الركبة الخلفية تقرب من الأرض.", "ادفع بالرجل الأمامية لفوق."],
    mistakes: ["خطوة قصيرة بتحمّل الركبة الأمامية زيادة.", "فقدان توازن بسبب عدم تثبيت القدمين."],
    tips: ["تمرين تحضيري ممتاز قبل الانتقال للبلغاري (رجل مرفوعة) — نفس الحركة بتوازن أسهل.", "ابدأ بوزن الجسم بس لحد ما تظبط الوضع."],
    illustration: "https://musclewiki.com/exercise/dumbbell-split-squat",
  }),
  ExDB({
    id: "bulgarian-split-squat", en: "Bulgarian Split Squat", ar: "سكوات بلغاري", group: "quads",
    primary: "Quads", secondary: "Glutes", equipment: "Dumbbell", difficulty: "Advanced",
    instructions: ["حط رجلك الخلفية على مقعد مرتفع خلفك.", "انزل بالرجل الأمامية لحد ما الفخذ يبقى موازي للأرض تقريبًا.", "ادفع بكعب الرجل الأمامية لفوق."],
    mistakes: ["ميل الجذع لقدام بشكل زيادة بيحول الشغل كله للجلوت.", "الركبة الأمامية بتتعدى الإصبع بشكل مبالغ فيه مع فقدان توازن."],
    tips: ["حافظ على ثبات الجذع تقريبًا رأسي.", "ابدأ بدون وزن لحد ما تظبط التوازن."],
    illustration: "https://musclewiki.com/exercise/dumbbell-bulgarian-split-squat",
  }),
  ExDB({
    id: "sissy-squat", en: "Sissy Squat", ar: "سيسي سكوات", group: "quads",
    primary: "Quads (خصوصًا Rectus Femoris)", secondary: "—", equipment: "Bodyweight", difficulty: "Advanced",
    instructions: ["امسك حاجة ثابتة للتوازن، ارفع كعبك عن الأرض.", "انزل جذعك للخلف مع ثني الركبة، جسمك في خط مايل واحد.", "ارجع لفوق بشد الكوادز."],
    mistakes: ["ثني الورك بدل الحفاظ على جذع مستقيم مايل.", "نزول عميق جدًا من غير قوة كافية في الكوادز يسبب فقدان توازن."],
    tips: ["تمرين متقدم بيمد الكوادز في وضع مطول أوي تحت حمل وزن الجسم — ابدأ بمدى حركة صغير وزوده تدريجيًا.", "ينفع تتمسك بحاجة تابتة (باب أو عمود) لحد ما تقوى."],
    illustration: "https://www.muscleandstrength.com/exercises/sissy-squat.html",
  }),

  // ================= HAMSTRINGS =================
  // Ordered: RDL (largest evidence base for hip-hinge hamstring loading
  // at long muscle length) → seated leg curl (recent evidence shows
  // superior hamstring hypertrophy vs prone due to greater muscle
  // length) → lying/prone leg curl (still solid, very common) → Nordic
  // curl (strongest evidence specifically for reducing hamstring strain
  // injuries) → single-leg / good morning / GHR / pull-through.
  ExDB({
    id: "rdl", en: "Romanian Deadlift (RDL)", ar: "رومانين ديدليفت", group: "hamstrings",
    primary: "Hamstrings", secondary: "Glutes, أسفل الظهر", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["امسك البار وقفة عرض الكتف تقريبًا.", "ادفع الحوض للخلف مع نزول البار قريب من رجلك، الضهر مستقيم.", "لما تحس بشد قوي في الهامسترينج، ارجع لفوق بدفع الحوض لقدام."],
    mistakes: ["تقويس أو تقعير أسفل الظهر أثناء النزول.", "ثني الركبة كتير فبيتحول لسكوات بدل هينج."],
    tips: ["الحركة من الورك (Hip Hinge) مش من الركبة.", "ابدأ بوزن خفيف لحد ما تظبط الفورم."],
    illustration: "https://musclewiki.com/exercise/barbell-romanian-deadlift",
  }),
  ExDB({
    id: "seated-leg-curl", en: "Seated Leg Curl (Machine)", ar: "سيتد ليج كيرل", group: "hamstrings",
    primary: "Hamstrings", secondary: "—", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد والوسادة فوق الكاحل، الظهر مسند.", "اثني الركبة واسحب الوسادة لتحت.", "ارجع ببطء لحد بداية الحركة."],
    mistakes: ["رفع الحوض عن المقعد أثناء الشد.", "زخم سريع بدل حركة متحكم فيها."],
    tips: ["وضع القعاد بيمد الهامسترينج عند الورك بشكل أكبر من الجهاز القاعد على البطن، وأبحاث حديثة (Maeo وزملاؤه 2021) لقت نمو أكبر في الهامسترينج مع الوضع ده — لو الجهازين متاحين في الجيم، ابدأ بيه.", "وقفة خفيفة في نهاية الشد بتزود التفعيل."],
    illustration: "https://musclewiki.com/exercise/machine-seated-leg-curl",
  }),
  ExDB({
    id: "lying-leg-curl", en: "Lying Leg Curl (Prone)", ar: "لايينج ليج كيرل", group: "hamstrings",
    primary: "Hamstrings", secondary: "—", equipment: "Machine", difficulty: "Beginner",
    instructions: ["استلقي على بطنك، الوسادة فوق الكاحل.", "اثني الركبة واسحب الوسادة لحد قريب من المؤخرة.", "ارجع ببطء."],
    mistakes: ["رفع الحوض عن المقعد أثناء الشد.", "مدى حركة قصير بسبب وزن زيادة عن قدرتك."],
    tips: ["لسه تمرين فعال وشائع جدًا، حتى لو النسخة القاعدة عندها ميزة طفيفة حسب أحدث الأبحاث — استخدم اللي متاح عندك في الجيم.", "قدم مفرودة شوية (مش مقفولة تمامًا) بتقلل ضغط غير ضروري على الركبة."],
    illustration: "https://musclewiki.com/exercise/machine-hamstring-curl",
  }),
  ExDB({
    id: "nordic-hamstring-curl", en: "Nordic Hamstring Curl", ar: "نوردك كيرل", group: "hamstrings",
    primary: "Hamstrings", secondary: "—", equipment: "Bodyweight", difficulty: "Advanced",
    instructions: ["اركع وثبّت كاحلك (شريك أو جهاز مخصص).", "انزل جذعك لقدام ببطء قد ما تقدر، مقاوم بالهامسترينج.", "لما تفقد التحكم، اكمل النزول بالإيدين وادفع نفسك لفوق تاني."],
    mistakes: ["النزول بسرعة (سقوط) بدل مقاومة بطيئة متحكم فيها.", "ثني الورك بدل الحفاظ على جسم مستقيم من الركبة للراس."],
    tips: ["أقوى تمرين موثّق لتقليل إصابات شد الهامسترينج تحديدًا (قوة إكسنتريك عالية) — يستاهل يتضاف حتى بحجم صغير (2-3 عدات) لبرنامج فيه جري أو رياضات انفجارية.", "تمرين صعب جدًا في البداية؛ ابدأ بمساعدة شريط مقاومة أو مدى حركة جزئي."],
    illustration: "https://musclewiki.com/exercise/nordic-hamstring-curl",
  }),
  ExDB({
    id: "single-leg-rdl", en: "Single-Leg RDL", ar: "سينجل ليج رومانين ديدليفت", group: "hamstrings",
    primary: "Hamstrings", secondary: "Glutes, Core (توازن)", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["امسك دمبلز في إيد واحدة أو الاتنين، قف على رجل واحدة.", "ادفع الحوض للخلف مع مد الرجل التانية للخلف، الضهر مستقيم.", "ارجع لفوق بدفع الحوض لقدام."],
    mistakes: ["لف الحوض بدل الحفاظ عليه مستوي.", "فقدان توازن بسبب سرعة زيادة."],
    tips: ["يضيف مكون توازن وثبات جوهر مهم جنب شد الهامسترينج، ومفيد لكشف أي فرق قوة بين الرجلين.", "امسك حاجة ثابتة في البداية لحد ما يتحسن توازنك."],
    illustration: "https://musclewiki.com/exercise/single-legged-romanian-deadlifts",
  }),
  ExDB({
    id: "good-morning", en: "Good Morning", ar: "جود مورنينج", group: "hamstrings",
    primary: "Hamstrings", secondary: "أسفل الظهر, Glutes", equipment: "Barbell", difficulty: "Advanced",
    instructions: ["حط البار على الترابيس العلوي زي السكوات.", "ادفع الحوض للخلف مع انحناء الجذع لقدام، الركبة فيها انحناءة خفيفة ثابتة.", "ارجع لفوق بدفع الحوض لقدام."],
    mistakes: ["تقويس أو تقعير الظهر تحت حمل.", "انحناء كبير أوي من غير قوة كافية في الهامسترينج والظهر."],
    tips: ["تمرين متقدم بيحتاج تحكم كويس في وضع الورك — ابدأ بوزن خفيف جدًا (حتى البار فاضي) وزوّد تدريجيًا.", "شبيه بالرفعة الرومانية لكن بالبار على الضهر بدل اليدين، فبيحتاج توازن إضافي."],
    illustration: "https://musclewiki.com/exercise/barbell-high-bar-good-morning",
  }),
  ExDB({
    id: "glute-ham-raise", en: "Glute-Ham Raise (GHR)", ar: "جلوت-هام ريز", group: "hamstrings",
    primary: "Hamstrings", secondary: "Glutes", equipment: "Machine", difficulty: "Advanced",
    instructions: ["اركع على جهاز الـ GHR، كاحلك مثبت.", "انزل جذعك لقدام بثني الركبة تدريجيًا، مقاوم بالهامسترينج.", "ارجع لفوق بشد الهامسترينج والجلوت."],
    mistakes: ["الاعتماد على الظهر بدل الهامسترينج في الرجوع.", "نزول سريع بدل مقاومة متحكم فيها."],
    tips: ["بيجمع بين مد الورك وثني الركبة في حركة واحدة، وده بيخليه من أكتر التمارين اكتمالًا للهامسترينج — بس محتاج جهاز مخصص مش دايمًا متاح.", "لو الجهاز مش متاح، النوردك كيرل بديل قريب في الفايدة."],
    illustration: "https://musclewiki.com/exercise/glute-ham-raise",
  }),
  ExDB({
    id: "cable-pull-through", en: "Cable Pull-Through", ar: "كيبل بول ثرو", group: "hamstrings",
    primary: "Hamstrings", secondary: "Glutes", equipment: "Cable", difficulty: "Beginner",
    instructions: ["وقف وضهرك للبكرة السفلية، الحبل بين رجليك.", "ادفع الحوض للخلف مع انحناء بسيط، الضهر مستقيم.", "ارجع لفوق بدفع الحوض لقدام وعصر الجلوت."],
    mistakes: ["ثني الركبة كتير فبيتحول لسكوات.", "تقويس أسفل الظهر."],
    tips: ["أداة تعليمية ممتازة لحركة الـ Hip Hinge قبل ما تنتقل للرفعة الرومانية بوزن تقيل — الكيبل بيوجه الحركة بشكل طبيعي.", "خيار كويس ومريح لأسفل الظهر لمين عنده حساسية."],
    illustration: "https://musclewiki.com/exercise/cable-pull-through",
  }),

  // ================= GLUTES =================
  ExDB({
    id: "hip-thrust", en: "Barbell Hip Thrust", ar: "هيب ثرست بار", group: "glutes",
    primary: "Glute Max", secondary: "Hamstrings", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["اسند الظهر العلوي على بنش، البار فوق الحوض.", "ادفع بكعبك وارفع الحوض لفوق مع عصر الجلوت في القمة.", "انزل بتحكم من غير ما الحوض يلمس الأرض."],
    mistakes: ["مد الرقبة للخلف بشكل مبالغ فيه أثناء الدفع.", "استخدام أسفل الظهر بدل الجلوت للدفع."],
    tips: ["حط padding على البار عشان راحة الحوض.", "وقفة نصف ثانية في القمة بتزود التفعيل — أبحاث EMG بتوريه بيدّي أعلى تفعيل مباشر للجلوت من السكوات لأنه بيحمّلها في أقصر وضع ليها."],
    illustration: "https://musclewiki.com/exercise/barbell-hip-thrust",
  }),
  ExDB({
    id: "glute-bridge", en: "Glute Bridge", ar: "جلوت بريدج", group: "glutes",
    primary: "Glute Max", secondary: "Hamstrings", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على ضهرك، الركب مثنية والقدم مسطحة بالأرض.", "ادفع بكعبك وارفع الحوض لفوق مع عصر الجلوت.", "انزل بتحكم."],
    mistakes: ["الدفع بأسفل الظهر بدل الجلوت.", "فتح الركب للخارج أثناء الرفع."],
    tips: ["نفس حركة الهيب ثرست بس على الأرض — نقطة بداية ممتازة قبل ما تنتقل للنسخة بالبنش والبار.", "لتحدي أكبر، جرب Single-leg Glute Bridge."],
    illustration: "https://musclewiki.com/exercise/glute-bridge",
  }),
  ExDB({
    id: "single-leg-hip-thrust", en: "Single-Leg Hip Thrust", ar: "سينجل ليج هيب ثرست", group: "glutes",
    primary: "Glute Max", secondary: "Hamstrings, Core (توازن)", equipment: "Bodyweight", difficulty: "Intermediate",
    instructions: ["اسند ظهرك العلوي على بنش زي الهيب ثرست العادي، رجل واحدة بس على الأرض.", "الرجل التانية ممدودة أو مرفوعة قدامك.", "ادفع بكعب الرجل الشغالة وارفع الحوض، اعصر الجلوت فوق."],
    mistakes: ["لف الحوض لجانب أثناء الدفع.", "الاعتماد على الرجل المرفوعة للمساعدة بدل عزل الشغالة."],
    tips: ["تقدر تكشف بيه فرق قوة بين الرجلين وتزود الشد على كل جانب لوحده من غير الحاجة لوزن إضافي.", "لو صعب التوازن، ابدأ بالرجل التانية على كرسي منخفض قدامك."],
    illustration: "https://www.muscleandstrength.com/exercises/single-leg-hip-thrust",
  }),
  ExDB({
    id: "sumo-deadlift", en: "Sumo Deadlift", ar: "سومو ديدليفت", group: "glutes",
    primary: "Glutes", secondary: "Quads (Adductors), Hamstrings", equipment: "Barbell", difficulty: "Advanced",
    instructions: ["قف بوقفة واسعة، أصابع القدم لبره شوية، البار قريب من قصبتك.", "امسك البار من جوه الرجلين، الظهر مستقيم.", "ادفع بالأرض وارفع البار مع مد الورك والركبة."],
    mistakes: ["وقفة واسعة أوي أو ضيقة أوي بتخلي الحركة مش مريحة.", "تقويس الظهر تحت الحمل."],
    tips: ["الوقفة الواسعة بتقلل مسافة سفر البار وبتزود شغل الجلوت والفخذ الداخلي مقارنة بالرفعة التقليدية.", "مرونة الورك والكاحل مهمة هنا — سخّن كويس قبل الوزن التقيل."],
    illustration: "https://musclewiki.com/exercise/barbell-sumo-deadlift",
  }),
  ExDB({
    id: "step-up", en: "Step-Up", ar: "ستيب أب", group: "glutes",
    primary: "Glutes", secondary: "Quads, Hamstrings", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["قف قدام صندوق أو بنش بارتفاع مناسب (تحت الركبة تقريبًا).", "اصعد بالرجل كاملة (رجل واحدة تدفع، مش تساعد الأرض).", "انزل بتحكم وارجع بنفس الرجل أو التانية."],
    mistakes: ["الدفع بالرجل التانية من الأرض بدل خلي الرجل اللي فوق تعمل الشغل كله.", "ارتفاع صندوق عالي جدًا بيجبرك تستخدم زخم."],
    tips: ["تمرين وظيفي شائع بيقرّب لحركات الحياة اليومية (زي طلوع السلم) مع تحميل جيد للجلوت والكوادز.", "ابدأ بارتفاع منخفض وزوده تدريجيًا مع التحكم في الفورم."],
    illustration: "https://musclewiki.com/exercise/dumbbell-step-up",
  }),
  ExDB({
    id: "walking-lunge", en: "Walking Lunge", ar: "ووكينج لانج", group: "glutes",
    primary: "Glutes", secondary: "Quads, Hamstrings", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["امسك دمبلز في كل إيد (اختياري) وقف واقف.", "اخطو خطوة واسعة لقدام وانزل لحد ما الركبة الخلفية تقرب من الأرض.", "ادفع بالرجل الأمامية وكمل خطوة تانية."],
    mistakes: ["خطوة قصيرة بتحمّل الركبة الأمامية زيادة.", "ميل الجذع لقدام بشكل زيادة."],
    tips: ["حافظ على جذع شبه رأسي طول الحركة.", "ابدأ بوزن الجسم بس لحد ما تظبط التوازن."],
    illustration: "https://www.muscleandstrength.com/exercises/dumbbell-walking-lunge.html",
  }),
  ExDB({
    id: "cable-kickback", en: "Cable Glute Kickback", ar: "كيبل كيك باك", group: "glutes",
    primary: "Glute Max", secondary: "Hamstrings", equipment: "Cable", difficulty: "Beginner",
    instructions: ["اربط الحزام في كاحلك وقف قدام الكيبل، انحني بجذعك خفيف لقدام.", "ادفع رجلك للخلف وفوق مع عصر الجلوت.", "ارجع ببطء من غير ما توصل لقدام أوي."],
    mistakes: ["تقويس أسفل الظهر بدل تثبيت الجذع.", "الرفع بسرعة زيادة (زخم) بدل عصر متحكم فيه."],
    tips: ["ركز على حركة قصيرة ومتحكم فيها بدل مدى كبير وسريع.", "امسك حاجة ثابتة للتوازن لو محتاج."],
    illustration: "https://musclewiki.com/exercise/cable-standing-glute-kickback",
  }),
  ExDB({
    id: "hip-abduction-machine", en: "Hip Abduction Machine", ar: "هيب أبدكشن مشين", group: "glutes",
    primary: "Glute Medius/Minimus", secondary: "—", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد في الجهاز، الوسادتين على برة الفخذين.", "افتح الرجلين للخارج ضد المقاومة.", "ارجع ببطء لحد بداية الحركة."],
    mistakes: ["استخدام وزن تقيل جدًا بيقصر مدى الحركة.", "الاستناد على ظهر المقعد بدل التحكم بالعضلة."],
    tips: ["العضلات الجانبية للجلوت (Medius/Minimus) غالبًا بتتنسى في برامج التركيز على Glute Max بس — مهمة لثبات الحوض وشكل الجلوت الجانبي.", "وقفة خفيفة في نهاية الفتح بتزود التفعيل."],
    illustration: "https://musclewiki.com/exercise/machine-hip-abduction",
  }),

  // ================= CALVES =================
  // Straight-knee (standing) variants load the biarticular gastrocnemius
  // more; bent-knee (seated) variants shift emphasis to the soleus,
  // which is well established biomechanically (the gastrocnemius goes
  // slack once the knee is flexed). Order favors the most common,
  // highest-loading option first, then the biomechanical soleus/gastroc
  // split, then accessible bodyweight/home variants.
  ExDB({
    id: "standing-calf-raise-machine", en: "Standing Calf Raise (Machine)", ar: "ستاندينج كاف ريز", group: "calves",
    primary: "Gastrocnemius", secondary: "Soleus", equipment: "Machine", difficulty: "Beginner",
    instructions: ["قف في الجهاز، الكتف تحت الوسادة والركبة مفرودة.", "انزل الكعب لتحت لحد شد كامل.", "ارتفع على صوابعك لأعلى نقطة ممكنة."],
    mistakes: ["مدى حركة قصير (مش نازل لآخر مدى).", "ارتداد سريع بدل حركة متحكم فيها."],
    tips: ["الركبة المفرودة بتخلي الـ Gastrocnemius (العضلة السطحية اللي بتبان) شغالة بأقصى كفاءة.", "وقفة نص ثانية فوق وتحت بتزود التفعيل."],
    illustration: "https://musclewiki.com/exercise/machine-standing-calf-raises",
  }),
  ExDB({
    id: "seated-calf-raise-machine", en: "Seated Calf Raise (Machine)", ar: "سيتد كاف ريز", group: "calves",
    primary: "Soleus", secondary: "Gastrocnemius", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد في الجهاز، الوسادة فوق الركبة والكعب حر.", "انزل الكعب لتحت لحد شد كامل.", "ارتفع على صوابعك لأعلى نقطة."],
    mistakes: ["مدى حركة قصير.", "استخدام زخم بدل حركة متحكم فيها."],
    tips: ["ثني الركبة بيقلل مشاركة الـ Gastrocnemius فبيركز الشغل على الـ Soleus اللي تحتها — العضلة دي كبيرة الحجم وليها دور مهم في سمك السمانة الكلي، فمكملة للرفعة الواقفة مش بديلة عنها.", "استخدم مدى حركة كامل حتى لو بوزن أقل."],
    illustration: "https://musclewiki.com/exercise/machine-seated-calf-raises",
  }),
  ExDB({
    id: "standing-calf-raise-barbell", en: "Standing Barbell Calf Raise", ar: "ستاندينج كاف ريز بار", group: "calves",
    primary: "Gastrocnemius", secondary: "Soleus", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["حط البار على الترابيس العلوي، صوابعك على حرف مرتفع (لوح أو قرص).", "انزل الكعب لتحت لحد شد كامل.", "ارتفع لأعلى نقطة ممكنة."],
    mistakes: ["فقدان توازن بسبب الوقوف على حرف مرتفع.", "مدى حركة قصير."],
    tips: ["خيار كويس لو مفيش جهاز سمانة مخصص متاح في الجيم — يديك تحميل تقيل زي الجهاز تقريبًا.", "امسك حاجة ثابتة بإيدك لو محتاج توازن إضافي."],
    illustration: "https://musclewiki.com/exercise/barbell-calf-raises",
  }),
  ExDB({
    id: "leg-press-calf-raise", en: "Leg Press Calf Raise", ar: "ليج بريس كاف ريز", group: "calves",
    primary: "Gastrocnemius", secondary: "Soleus", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد في جهاز الليج بريس، صوابعك بس على حرف اللوح.", "افك القفل شوية وادفع باللوح بالكعب لتحت وفوق.", "حافظ على مدى حركة كامل."],
    mistakes: ["ركبة مقفولة بالكامل بدل ثابتة شبه مفرودة.", "مدى حركة قصير."],
    tips: ["بديل عملي جدًا لو مفيش جهاز سمانة مخصص — استخدم جهاز الليج بريس الموجود أصلًا.", "قفل جزء صغير من قفل الأمان يمنع اللوح من الرجوع لجوه أوي."],
    illustration: "https://musclewiki.com/exercise/machine-horizontal-leg-press-calf-raise",
  }),
  ExDB({
    id: "donkey-calf-raise", en: "Donkey Calf Raise", ar: "دونكي كاف ريز", group: "calves",
    primary: "Gastrocnemius", secondary: "Soleus", equipment: "Machine", difficulty: "Intermediate",
    instructions: ["انحني لقدام في جهاز الدونكي، جذعك موازي للأرض تقريبًا.", "انزل الكعب لتحت لحد شد كامل.", "ارتفع لأعلى نقطة."],
    mistakes: ["مدى حركة قصير.", "فقدان استقامة الظهر أثناء الحركة."],
    tips: ["وضع الجذع الأفقي بيدّي زاوية إطالة مختلفة شوية عن الرفعة الواقفة العادية — تنويعة قديمة لكن لسه شائعة في بعض الجيمات.", "لو الجهاز المخصص مش موجود، الرفعة الواقفة العادية بديل كافي."],
    illustration: "https://musclewiki.com/exercise/machine-donkey-calf-raise",
  }),
  ExDB({
    id: "single-leg-calf-raise", en: "Single-Leg Calf Raise", ar: "سينجل ليج كاف ريز", group: "calves",
    primary: "Gastrocnemius", secondary: "Soleus", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["قف على رجل واحدة على حرف درجة سلم أو لوح مرتفع.", "انزل الكعب لتحت لحد شد كامل.", "ارتفع لأعلى نقطة ممكنة."],
    mistakes: ["فقدان توازن بدون مسكة ثابتة.", "مدى حركة قصير."],
    tips: ["أفضل خيار بوزن الجسم بس (البيت/بدون معدات) — الوزن على رجل واحدة بيدّي حمل كافي لمعظم المستويات.", "امسك حاجة ثابتة بإيدك للتوازن، وزوّد الصعوبة بإيدك فاضية أو دمبلز."],
    illustration: "https://musclewiki.com/exercise/bodyweight-single-leg-calf-raise",
  }),

  // ================= ABS / CORE =================
  // EMG-based rankings for ab exercises (e.g. the widely-cited ACE-
  // sponsored study) give a rough guide but aren't a strong hypertrophy
  // predictor, so order here also weighs range of motion and how easily
  // an exercise can be progressively loaded over time.
  ExDB({
    id: "hanging-leg-raise", en: "Hanging Leg Raise", ar: "هانجينج ليج ريز", group: "core",
    primary: "Lower Abs", secondary: "Hip Flexors", equipment: "Bodyweight", difficulty: "Advanced",
    instructions: ["اتعلق على البار بقبضة ثابتة.", "ارفع الرجلين (مفرودة أو مثنية) لحد مستوى الحوض تقريبًا.", "انزل ببطء من غير ما تهز جسمك."],
    mistakes: ["استخدام الزخم (Swinging) بدل رفع متحكم فيه.", "تقويس أسفل الظهر أثناء الرفع."],
    tips: ["لو صعب، ابدأ بثني الركبتين بدل مد الرجل بالكامل.", "ركز على شد البطن مش على سرعة الرفع."],
    illustration: "https://www.muscleandstrength.com/exercises/hanging-leg-raise.html",
  }),
  ExDB({
    id: "cable-crunch", en: "Cable Crunch (Kneeling)", ar: "نيلينج كيبل كرنش", group: "core",
    primary: "Upper Abs", secondary: "—", equipment: "Cable", difficulty: "Beginner",
    instructions: ["اركع قدام البكرة العالية، امسك الحبل جنب وشك.", "اثني جذعك لقدام وتحت من الوسط (مش من الورك)، اقرب المرفق للركبة.", "ارجع ببطء لحد مد شبه كامل."],
    mistakes: ["الحركة من الورك (زي الانحناء) بدل من العمود الفقري.", "الجلوس بالوراك ثابتة والحركة من الكتف بس."],
    tips: ["ميزته الكبرى إنك تقدر تزود عليه الوزن تدريجيًا زي أي تمرين تاني — ده بيخليه من أفضل خيارات النمو العضلي طويل المدى للبطن، بعكس الكرنش العادي المحدود بوزن الجسم.", "ركز على تدوير العمود الفقري (Spinal Flexion) مش على السحب لتحت بس."],
    illustration: "https://musclewiki.com/exercise/cable-rope-kneeling-crunch",
  }),
  ExDB({
    id: "plank", en: "Plank", ar: "بلانك", group: "core",
    primary: "Core (كامل)", secondary: "Shoulders", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["اتكئ على الساعدين وأصابع القدم، الجسم خط مستقيم.", "اشد البطن والجلوت واثبت.", "حافظ على التنفس الطبيعي طول المدة."],
    mistakes: ["سقوط الحوض لتحت أو ارتفاعه لفوق.", "حبس النفس بدل التنفس الطبيعي."],
    tips: ["ابدأ بمدد قصيرة (20-30 ث) وزود تدريجيًا.", "ركز على شد البطن مش بس على المدة."],
    illustration: "https://musclewiki.com/exercise/forearm-plank",
  }),
  ExDB({
    id: "ab-wheel-rollout", en: "Ab Wheel Rollout", ar: "أب ويل رول أوت", group: "core",
    primary: "Core (كامل)", secondary: "Lats, Shoulders", equipment: "Bodyweight", difficulty: "Advanced",
    instructions: ["اركع على الأرض، امسك العجلة قدامك بإيدين.", "ادحرج العجلة لقدام مع مد جسمك، حافظ على البطن مشدود.", "ارجع لبداية الحركة بشد البطن (مش بسحب الظهر)."],
    mistakes: ["نزول أسفل الظهر (تقعير) في نهاية المد — علامة إنك مديت أكتر من قدرتك.", "الرجوع بسحب الكتف بدل شد البطن."],
    tips: ["من أعلى تمارين البطن تفعيلًا لأنه بيحمّل العضلة في وضع مطول تمامًا — ابدأ بمدى حركة صغير (نص المسافة) وزوده تدريجيًا.", "لو صعب، جرب من على الركب لحيط بدل الأرض المفتوحة، أو ابدأ بالبلانك الديناميكي الأول."],
    illustration: "https://musclewiki.com/exercise/barbell-roll-outs?model=m",
  }),
  ExDB({
    id: "bicycle-crunch", en: "Bicycle Crunch", ar: "بايسكل كرنش", group: "core",
    primary: "Abs + Obliques", secondary: "Hip Flexors", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على ضهرك، الإيدين خلف الراس والركب مثنية فوق الحوض.", "لف جذعك وقرب المرفق من الركبة المعاكسة مع مد الرجل التانية.", "بدل الجانبين بحركة مستمرة ومتحكم فيها."],
    mistakes: ["سحب الراس بالإيدين بدل تحريك الجذع.", "سرعة زيادة بتفقد التحكم في الحركة."],
    tips: ["من أكتر تمارين البطن المتاحة اللي بتشغل الأوبليكس والبطن مع بعض في نفس الوقت من غير أي معدات.", "حركة بطيئة وواضحة أفضل من سرعة عشوائية."],
    illustration: "https://musclewiki.com/exercise/bicycle-crunch",
  }),
  ExDB({
    id: "pallof-press", en: "Pallof Press", ar: "بالوف برس", group: "core",
    primary: "Core (مضاد للدوران)", secondary: "—", equipment: "Cable", difficulty: "Intermediate",
    instructions: ["قف جنب البكرة، امسك القبضة بإيدين قدام صدرك.", "ادفع الإيدين لقدام مع مقاومة ميل جسمك للجنب.", "ارجع ببطء."],
    mistakes: ["لف الجذع مع الدفع بدل تثبيته.", "استخدام وزن تقيل يفقدك التحكم في الثبات."],
    tips: ["تمرين ممتاز لثبات الجذع اللي بيحمي أسفل الظهر يوميًا.", "لتقليل الصعوبة، قرب من نقطة التثبيت."],
    illustration: "https://musclewiki.com/exercise/cable-pallof-press",
  }),
  ExDB({
    id: "dead-bug", en: "Dead Bug", ar: "ديد باج", group: "core",
    primary: "Deep Core", secondary: "Hip Flexors (تحكم)", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على ضهرك، الذراعين لفوق والركب مثنية 90°.", "مد ذراع ورجل معاكسة ببطء لحد قريب من الأرض.", "ارجع وابدل الجانب."],
    mistakes: ["رفع أسفل الظهر عن الأرض أثناء المد.", "السرعة الزيادة بدل الحركة المتحكم فيها."],
    tips: ["ضهرك ملزق بالأرض طول الوقت، تنفس طبيعي.", "لو صعب، حرك رجل واحدة بس في كل مرة."],
    illustration: "https://musclewiki.com/exercise/dead-bug",
  }),
  ExDB({
    id: "reverse-crunch", en: "Reverse Crunch", ar: "ريفرس كرنش", group: "core",
    primary: "Lower Abs", secondary: "Hip Flexors", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على ضهرك، الركب مثنية 90° فوق الحوض.", "ارفع الحوض عن الأرض بشد البطن (مش برفس الرجل).", "انزل ببطء وتحكم."],
    mistakes: ["استخدام زخم الأرجل (رفس) بدل شد البطن الفعلي.", "مدى حركة كبير أوي بيحرك الظهر السفلي بشكل غير مريح."],
    tips: ["ركز على تدوير الحوض لفوق بشد البطن، مش على رفع الركب لأعلى نقطة ممكنة.", "بديل بوزن الجسم كويس لمين لسه مش وصل لمستوى الرفع المعلق."],
    illustration: "https://musclewiki.com/exercise/reverse-crunch",
  }),
  ExDB({
    id: "russian-twist", en: "Russian Twist", ar: "روسيان تويست", group: "core",
    primary: "Obliques", secondary: "Abs", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["اقعد وارجع بجذعك لخلف شوية، الركب مثنية والقدم إما على الأرض أو مرفوعة.", "امسك دمبلز أو وزن خفيف بإيدين قدام صدرك.", "لف الجذع يمين وشمال بالتبادل بحركة متحكم فيها."],
    mistakes: ["اللف السريع بيعتمد على الزخم مش على شد الأوبليكس الفعلي.", "تقويس الظهر بدل الحفاظ على جذع مستقيم مايل."],
    tips: ["لو عندك أي حساسية في أسفل الظهر، خلي القدم على الأرض بدل مرفوعة لتقليل الحمل.", "الوزن مش شرط يكون تقيل — التحكم في اللف أهم من ثقل الوزن."],
    illustration: "https://musclewiki.com/exercise/dumbbell-russian-twist",
  }),
  ExDB({
    id: "side-plank", en: "Side Plank", ar: "سايد بلانك", group: "core",
    primary: "Obliques", secondary: "Core (كامل)", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على جنبك، اتكئ على الساعد تحت الكتف مباشرة.", "ارفع حوضك عن الأرض لحد ما جسمك يبقى خط مستقيم.", "ثبت وحافظ على التنفس الطبيعي."],
    mistakes: ["سقوط الحوض لتحت أثناء الثبات.", "الكتف مش فوق الساعد مباشرة (بيحمّل المفصل غلط)."],
    tips: ["أفضل تمرين ثبات بسيط للأوبليكس بدون أي معدات.", "لو صعب، اثبت بالركبة السفلية على الأرض بدل القدم."],
    illustration: "https://musclewiki.com/exercise/elbow-side-plank",
  }),

  // ================= TRAPS =================
  ExDB({
    id: "barbell-shrug", en: "Barbell Shrug", ar: "رفع الكتفين بار", group: "traps",
    primary: "Upper Traps", secondary: "—", equipment: "Barbell", difficulty: "Beginner",
    instructions: ["امسك البار بقبضة عرض الكتف، قف باستقامة.", "ارفع الكتفين لفوق بأقصى مدى ممكن (زي ما بتقول \"مش عارف\").", "انزل ببطء."],
    mistakes: ["لف الكتفين في دوائر (مش ضروري وممكن يضايق المفصل) بدل رفع مستقيم لفوق وتحت.", "استخدام زخم الركب للمساعدة في الرفع."],
    tips: ["الحركة أبسط ما يكون — رفع الكتف لفوق وتحت بس، من غير لف.", "وقفة نص ثانية في القمة بتزود التفعيل."],
    illustration: "https://musclewiki.com/exercise/barbell-shrug",
  }),
  ExDB({
    id: "dumbbell-shrug", en: "Dumbbell Shrug", ar: "رفع الكتفين دمبلز", group: "traps",
    primary: "Upper Traps", secondary: "—", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبلز في كل إيد جنب جسمك.", "ارفع الكتفين لفوق بأقصى مدى ممكن.", "انزل ببطء."],
    mistakes: ["لف الكتفين بدل رفع مستقيم.", "هز الجسم كله للمساعدة."],
    tips: ["الدمبلز بيدي مدى حركة أوسع شوية من البار، خصوصًا في مرحلة النزول.", "خيار سهل الوصول في أي جيم."],
    illustration: "https://musclewiki.com/exercise/dumbbell-shrug",
  }),
  ExDB({
    id: "farmers-carry", en: "Farmer's Carry", ar: "فارمرز كاري", group: "traps",
    primary: "Traps", secondary: "Forearms (Grip), Core", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبلز أو كيتل بيل تقيل في كل إيد.", "قف باستقامة، الكتف للخلف وتحت شوية.", "امشي مسافة معينة أو وقت معين وأنت محافظ على الوضع."],
    mistakes: ["ترك الكتف يسقط لقدام أو ينحني الجذع.", "خطوات سريعة أوي بتفقدك التحكم في الوضع."],
    tips: ["تمرين وظيفي بيجمع بين تحميل الترابيس وتحمّل القبضة والثبات في تمرين واحد بسيط.", "ابدأ بوزن تقدر تحافظ بيه على وضع مستقيم لمسافة معقولة."],
    illustration: "https://musclewiki.com/exercise/dumbbell-farmer-walk",
  }),
  ExDB({
    id: "cable-shrug", en: "Cable Shrug", ar: "رفع الكتفين كيبل", group: "traps",
    primary: "Upper Traps", secondary: "—", equipment: "Cable", difficulty: "Beginner",
    instructions: ["قف قدام البكرة السفلية، امسك القبضة أو البار جنب جسمك.", "ارفع الكتفين لفوق.", "انزل ببطء."],
    mistakes: ["لف الكتفين بدل رفع مستقيم.", "الميل بالجذع للمساعدة في الرفع."],
    tips: ["الكيبل بيدي شد مستمر على العضلة طول الحركة، بعكس الدمبلز اللي بيقل شده في أعلى نقطة.", "بديل كويس لو مزاحم على البار الحر."],
    illustration: "https://www.muscleandstrength.com/exercises/cable-shrug.html",
  }),
  ExDB({
    id: "behind-back-barbell-shrug", en: "Behind-the-Back Barbell Shrug", ar: "رفع الكتفين بار من الخلف", group: "traps",
    primary: "Upper Traps", secondary: "—", equipment: "Barbell", difficulty: "Intermediate",
    instructions: ["امسك البار خلف ضهرك بقبضة عرض الكتف تقريبًا.", "ارفع الكتفين لفوق بأقصى مدى ممكن.", "انزل ببطء."],
    mistakes: ["مرونة كتف/رسغ غير كافية بتخلي الوضع غير مريح — لو حسيت ألم، ارجع لرفع الكتفين العادي قدام الجسم.", "لف الكتفين بدل رفع مستقيم."],
    tips: ["الوضع من الخلف بيدّي زاوية شد مختلفة شوية للترابيس عن رفع الكتفين العادي قدام الجسم — تنويع شائع بين لاعبي القوة.", "محتاج تسخين كويس لمفصل الكتف قبل ما تستخدم وزن تقيل."],
    illustration: "https://musclewiki.com/exercise/barbell-behind-the-back-30-degree-shrug",
  }),
  ExDB({
    id: "rack-pull", en: "Rack Pull", ar: "راك بُل", group: "traps",
    primary: "Traps", secondary: "أسفل الظهر, Lats (ثبات)", equipment: "Barbell", difficulty: "Advanced",
    instructions: ["حط البار على حوامل بارتفاع تحت الركبة تقريبًا داخل الراك.", "امسك البار زي الرفعة الميتة، الظهر مستقيم.", "ادفع بالأرض وارفع البار لحد الوقفة الكاملة، وانزل بتحكم."],
    mistakes: ["البدء بارتفاع منخفض جدًا بيقلل الفايدة من كونه رفعة جزئية.", "تقويس الظهر تحت وزن تقيل."],
    tips: ["مدى الحركة الجزئي (بداية من تحت الركبة) بيسمح بوزن أتقل من الرفعة الميتة الكاملة، وده بيحمّل الترابيس والظهر العلوي بشكل قوي — شائع جدًا بين لاعبي القوة.", "مش بديل عن الرفعة الميتة الكاملة، ده تمرين إضافي منفصل."],
    illustration: "https://musclewiki.com/exercise/barbell-rack-pull",
  }),
  // ================= PHASE 3 ADDITIONS (phase3-additions) =================
  // v1.14.0: resistance-band exercises, no-equipment home options and a
  // few gym gap-fillers so every exercise has a like-for-like substitute
  // (see exercise-alternatives.js + IMPLEMENTATION_STATUS.md). Appended
  // after the original 104 so existing ids/order are untouched. These
  // entries have no `illustration` on purpose: links are only added once a
  // direct exercise page has been verified (never guessed from the name).
  ExDB({
    id: "band-chest-press", en: "Band Chest Press", ar: "ضغط صدر بالحزام", group: "chest",
    primary: "Mid Chest", secondary: "Front Delts, Triceps", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام خلف ضهرك أو في عمود ثابت بمستوى الصدر.", "امسك الطرفين وادفع لقدام لحد مد الذراعين.", "ارجع ببطء مع التحكم في شد الحزام."],
    mistakes: ["تثبيت الحزام في مكان غير آمن ممكن يخليه ينفلت.", "رفع الكتفين لفوق أثناء الدفع."],
    tips: ["اتقدّم خطوة لقدام أو استخدم حزام أتخن لزيادة المقاومة.", "بديل مناسب للبنش لما مفيش بار أو جهاز متاح."],
  }),

  ExDB({
    id: "band-chest-fly", en: "Band Chest Fly", ar: "فلاي صدر بالحزام", group: "chest",
    primary: "Mid Chest", secondary: "Front Delts", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام خلفك بمستوى الصدر وامسك الطرفين والمرفقين مثنيين بخفة.", "اجمع الإيدين قدام صدرك في قوس واسع.", "افتح ببطء لحد ما تحس بشد في الصدر."],
    mistakes: ["ثني المرفق أكتر وتحويل الحركة لضغط.", "فتح الذراعين لأبعد من مستوى الكتف."],
    tips: ["المقاومة بتزيد في نهاية الحركة، فاعصر الصدر ثانية عند الضم.", "تقدر تغير زاوية التثبيت لاستهداف الصدر العلوي."],
  }),

  ExDB({
    id: "band-lat-pulldown", en: "Band Lat Pulldown", ar: "سحب لاتس بالحزام", group: "back",
    primary: "Lats", secondary: "Biceps, Rear Delts", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام فوق راسك على عارضة أو باب ثابت.", "اجلس أو اركع وامسك الحزام بمسافة أوسع من الكتف.", "اسحب لحد أعلى الصدر مع نزول المرفقين لجنبك، وارجع ببطء."],
    mistakes: ["شد الرقبة لقدام أثناء السحب.", "استخدام الجسم كله بدل عضلات الظهر."],
    tips: ["فكّر إنك بتسحب المرفقين لجيوبك مش بتشد بإيدك.", "بديل جيد للبول داون في البيت."],
  }),

  ExDB({
    id: "band-seated-row", en: "Band Seated Row", ar: "تجديف جالس بالحزام", group: "back",
    primary: "Mid Back", secondary: "Lats, Biceps", equipment: "Band", difficulty: "Beginner",
    instructions: ["اقعد على الأرض ورجليك مفرودة وحط الحزام حوالين القدمين.", "امسك الطرفين واسحب لبطنك مع ضم لوحي الكتف.", "ارجع ببطء من غير ما تتساقط للأمام."],
    mistakes: ["تقويس الضهر أثناء السحب.", "سحب الكتفين لفوق نحو الأذن."],
    tips: ["اثبت في نهاية السحب ثانية عشان تزود الشد في الظهر.", "اختار حزام يخليك تكمل 12-15 عدّة بشكل صحيح."],
  }),

  ExDB({
    id: "band-straight-arm-pulldown", en: "Band Straight-Arm Pulldown", ar: "ستريت آرم بالحزام", group: "back",
    primary: "Lats", secondary: "Teres Major, Triceps (long head)", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام فوق راسك وامسكه بذراعين شبه مفرودين.", "اسحب الحزام لتحت لحد الفخذين بالتحكم من اللاتس.", "ارجع ببطء لحد ما تحس بإطالة في الجنب."],
    mistakes: ["ثني المرفق وتحويلها لضغط ترايسبس.", "الميل الزايد بالجسم لقدام."],
    tips: ["مناسب جدًا لعزل اللاتس في البيت.", "ركز على إنك بتنزل الكتف مش بتشد بالذراع."],
  }),

  ExDB({
    id: "band-pull-apart", en: "Band Pull-Apart", ar: "فتح الحزام للخلف", group: "shoulders",
    primary: "Rear Delts", secondary: "Mid Back, Traps", equipment: "Band", difficulty: "Beginner",
    instructions: ["امسك الحزام قدامك بذراعين مفرودين وبمستوى الكتف.", "افتح الذراعين للجانبين وضم لوحي الكتف.", "ارجع ببطء من غير ما تفقد الشد."],
    mistakes: ["رفع الكتفين نحو الأذن.", "تقويس أسفل الضهر أثناء الفتح."],
    tips: ["من أحسن التمارين لموازنة الدفع وتحسين وضعية الكتف.", "أعد 15-25 عدّة بحزام خفيف."],
  }),

  ExDB({
    id: "band-face-pull", en: "Band Face Pull", ar: "فيس بول بالحزام", group: "shoulders",
    primary: "Rear Delts", secondary: "Mid Back, Rotator Cuff", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام بمستوى الوش وامسك الطرفين.", "اسحب ناحية وشك مع فتح المرفقين للخارج.", "اثبت ثانية وارجع بتحكم."],
    mistakes: ["السحب لمستوى الصدر بدل الوش.", "تحريك الجذع للخلف لتعويض الوزن."],
    tips: ["بديل عملي للفيس بول بالكابل في البيت.", "ركز على ضم لوحي الكتف في نهاية السحب."],
  }),

  ExDB({
    id: "band-overhead-press", en: "Band Overhead Press", ar: "ضغط أكتاف بالحزام", group: "shoulders",
    primary: "Front Delts, Side Delts", secondary: "Triceps, Upper Chest", equipment: "Band", difficulty: "Beginner",
    instructions: ["قف على منتصف الحزام وامسك الطرفين عند الكتفين.", "ادفع لفوق لحد مد الذراعين فوق الراس.", "انزل ببطء لمستوى الكتف."],
    mistakes: ["تقويس أسفل الضهر أثناء الدفع.", "الدفع للأمام بدل خط مستقيم فوق الراس."],
    tips: ["شد البطن والجلوت عشان تحمي أسفل الضهر.", "المقاومة بتزيد لفوق، فاستخدم حزام مناسب."],
  }),

  ExDB({
    id: "band-lateral-raise", en: "Band Lateral Raise", ar: "رفرفة جانبية بالحزام", group: "shoulders",
    primary: "Side Delts", secondary: "Front Delts, Traps", equipment: "Band", difficulty: "Beginner",
    instructions: ["قف على الحزام وامسك الطرفين بجنبك.", "ارفع الذراعين للجانب لحد مستوى الكتف.", "انزل ببطء بدون ما ترتاح تمامًا تحت."],
    mistakes: ["رفع الكتفين لفوق بدل الذراعين.", "التأرجح بالجسم."],
    tips: ["المرفق أعلى من الإيد بشوية بيزود تركيز الكتف الجانبي.", "اعمل عدّات كتير (15-20) لأن المقاومة تدريجية."],
  }),

  ExDB({
    id: "band-front-raise", en: "Band Front Raise", ar: "رفرفة أمامية بالحزام", group: "shoulders",
    primary: "Front Delts", secondary: "Upper Chest", equipment: "Band", difficulty: "Beginner",
    instructions: ["قف على الحزام وامسك الطرفين قدام الفخذين.", "ارفع الذراعين لقدام لحد مستوى الكتف.", "انزل ببطء بتحكم."],
    mistakes: ["تأرجح الجسم لتحريك الحزام.", "رفع أعلى من مستوى الكتف بتقويس الضهر."],
    tips: ["الكتف الأمامي بيشتغل أصلًا في الضغط، فاعمل منه حجم قليل.", "حافظ على مرفقين مفرودين بخفة."],
  }),

  ExDB({
    id: "band-biceps-curl", en: "Band Biceps Curl", ar: "تبادل باي بالحزام", group: "biceps",
    primary: "Biceps", secondary: "Brachialis, Forearms", equipment: "Band", difficulty: "Beginner",
    instructions: ["قف على الحزام وامسك الطرفين والكفين لقدام.", "اثني المرفقين لحد ما الإيد توصل الكتف.", "انزل ببطء مع التحكم."],
    mistakes: ["تحريك المرفقين لقدام أثناء الثني.", "التأرجح بالضهر."],
    tips: ["المقاومة بتزيد في القمة، فاثبت ثانية وأنت بتعصر.", "تقدر تغير عرض القدمين لتغيير الشد."],
  }),

  ExDB({
    id: "band-triceps-pushdown", en: "Band Triceps Pushdown", ar: "بوش داون ترايسبس بالحزام", group: "triceps",
    primary: "Triceps", secondary: "Forearms", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام فوق راسك على باب أو عارضة وامسك الطرفين.", "ثبّت المرفقين بجنبك وافرد الذراعين لتحت.", "ارجع ببطء لحد ما الإيد توصل الصدر."],
    mistakes: ["تحريك المرفقين لقدام وورا.", "الميل بالجسم فوق الحزام."],
    tips: ["ممتاز لو الكيبل مش متاح.", "افرد الذراع بالكامل واعصر الترايسبس ثانية."],
  }),

  ExDB({
    id: "band-overhead-triceps-extension", en: "Band Overhead Triceps Extension", ar: "إكستنشن ترايسبس فوق الراس بالحزام", group: "triceps",
    primary: "Triceps (long head)", secondary: "Forearms", equipment: "Band", difficulty: "Beginner",
    instructions: ["قف على طرف الحزام وامسك الطرف التاني بالإيدين خلف راسك.", "افرد الذراعين لفوق مع تثبيت المرفقين.", "ارجع ببطء لحد ما تحس بشد في الترايسبس."],
    mistakes: ["فتح المرفقين للجانبين.", "تقويس أسفل الضهر أثناء الفرد."],
    tips: ["وضع الذراع فوق الراس بيشد الرأس الطويلة للترايسبس أكتر.", "حافظ على راسك ثابتة مش بتتحرك للأمام."],
  }),

  ExDB({
    id: "band-triceps-kickback", en: "Band Triceps Kickback", ar: "كيك باك ترايسبس بالحزام", group: "triceps",
    primary: "Triceps", secondary: "Rear Delts", equipment: "Band", difficulty: "Beginner",
    instructions: ["قف على الحزام وانحني بالجذع بزاوية مناسبة.", "ثبّت العضد جنبك وافرد الساعد للخلف.", "ارجع ببطء بدون ما ترفع العضد."],
    mistakes: ["تحريك العضد مع الفرد.", "استخدام زخم الجسم."],
    tips: ["اعصر الترايسبس ثانية عند الفرد الكامل.", "حزام خفيف وعدّات أكتر يكفي."],
  }),

  ExDB({
    id: "band-squat", en: "Band Squat", ar: "سكوات بالحزام", group: "quads",
    primary: "Quads", secondary: "Glutes, Hamstrings", equipment: "Band", difficulty: "Beginner",
    instructions: ["قف على الحزام وثبّت الطرف الثاني عند الكتفين.", "انزل لحد ما الفخذ يوازي الأرض مع ركب في اتجاه القدم.", "ادفع بالكعب لفوق مع مد الجسم."],
    mistakes: ["انهيار الركب للداخل.", "رفع الكعب من الأرض."],
    tips: ["حزام قوي بيعوض جزء من وزن البار لكن بحد أقصى أقل من الأوزان.", "مناسب للإحماء أو لتمرين بدون أدوات ثقيلة."],
  }),

  ExDB({
    id: "band-pull-through", en: "Band Pull-Through", ar: "بول ثرو بالحزام", group: "hamstrings",
    primary: "Hamstrings, Glutes", secondary: "Lower Back", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام منخفض خلفك وقف ورا ورجليك أوسع من الكتف.", "انحني من الورك ودفع الحوض للخلف بضهر مستقيم.", "ادفع الحوض لقدام وانتصب مع عصر الجلوت."],
    mistakes: ["ثني الضهر بدل الورك.", "ثني الركب أكتر من اللازم وتحويلها لسكوات."],
    tips: ["الحركة هي هينج، فركز على دفع الحوض للخلف.", "بديل جيد للكيبل بول ثرو في البيت."],
  }),

  ExDB({
    id: "band-leg-curl", en: "Band Leg Curl", ar: "ليج كيرل بالحزام", group: "hamstrings",
    primary: "Hamstrings", secondary: "Calves", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام على نقطة ثابتة ولفه حوالين الكاحل وانت على بطنك.", "اثني الركبة لحد ما يقرب الكعب من الجلوت.", "ارجع ببطء مع التحكم."],
    mistakes: ["رفع الحوض من الأرض أثناء الثني.", "الحركة السريعة بدون تحكم."],
    tips: ["لو الحزام ثقيل اعمل ثني بالرجلين مع بعض.", "اثبت ثانية عند أقصى انقباض."],
  }),

  ExDB({
    id: "band-glute-kickback", en: "Band Glute Kickback", ar: "كيك باك جلوت بالحزام", group: "glutes",
    primary: "Glutes", secondary: "Hamstrings", equipment: "Band", difficulty: "Beginner",
    instructions: ["لف الحزام حوالين الكاحلين أو القدم وانت على أربع.", "ارفع الرجل لورا مع عصر الجلوت.", "ارجع بتحكم من غير ما تلمس الأرض."],
    mistakes: ["تقويس أسفل الضهر لتعويض الحركة.", "رفع الرجل أعلى من اللازم."],
    tips: ["الحركة صغيرة من الورك مش من الضهر.", "ممتاز لتنشيط الجلوت قبل السكوات."],
  }),

  ExDB({
    id: "band-lateral-walk", en: "Band Lateral Walk", ar: "مشي جانبي بالحزام", group: "glutes",
    primary: "Glute Medius", secondary: "Glute Max", equipment: "Band", difficulty: "Beginner",
    instructions: ["حط الحزام فوق الركب أو الكاحل وخد وضع ربع سكوات.", "امشي خطوة للجنب مع حفاظ على الشد في الحزام.", "كرر في الاتجاهين."],
    mistakes: ["انهيار الركب للداخل.", "الوقوف بالكامل بين الخطوات وفقدان الشد."],
    tips: ["كلما نزلت الحزام لقرب الكاحل زادت الصعوبة.", "مناسب كتنشيط وكتمرين أساسي بعدّات عالية."],
  }),

  ExDB({
    id: "band-pallof-press", en: "Band Pallof Press", ar: "بالوف بريس بالحزام", group: "core",
    primary: "Obliques, Core", secondary: "Abs, Shoulders", equipment: "Band", difficulty: "Beginner",
    instructions: ["ثبّت الحزام بمستوى الصدر على جنبك وامسكه عند الصدر.", "ادفع الحزام لقدام لحد ما الذراعين تتفردوا مع مقاومة الدوران.", "ارجع ببطء من غير ما الجذع يلف."],
    mistakes: ["دوران الجذع باتجاه الحزام.", "رفع الكتف أو الميل للجانب."],
    tips: ["اثبت 2-3 ثواني عند الفرد الكامل.", "الابتعاد عن نقطة التثبيت يزود الصعوبة."],
  }),

  ExDB({
    id: "pike-pushup", en: "Pike Push-up", ar: "ضغط بايك للأكتاف", group: "shoulders",
    primary: "Front Delts, Side Delts", secondary: "Triceps, Upper Chest", equipment: "Bodyweight", difficulty: "Intermediate",
    instructions: ["ابدأ بوضع V مقلوب: الحوض لفوق والإيدين على الأرض.", "اثني المرفقين وانزل راسك ناحية الأرض.", "ادفع لفوق لحد مد الذراعين."],
    mistakes: ["نزول الجسم لقدام زي ضغط عادي.", "فتح المرفقين بزيادة."],
    tips: ["ارفع القدمين على كرسي لزيادة الصعوبة.", "أقرب بديل بوزن الجسم لضغط الأكتاف."],
  }),

  ExDB({
    id: "feet-elevated-pushup", en: "Feet-Elevated Push-up", ar: "ضغط بالقدمين مرتفعين", group: "chest",
    primary: "Upper Chest", secondary: "Front Delts, Triceps", equipment: "Bodyweight", difficulty: "Intermediate",
    instructions: ["حط القدمين على كرسي أو درجة والإيدين على الأرض.", "انزل بصدرك لحد قرب الأرض مع جسم مستقيم.", "ادفع لفوق لحد مد الذراعين."],
    mistakes: ["سقوط الحوض أو رفعه لفوق.", "نزول جزئي."],
    tips: ["كل ما رفعت القدمين زاد تركيز الصدر العلوي والكتف.", "بديل منزلي للإنكلاين بنش."],
  }),

  ExDB({
    id: "bench-dip", en: "Bench Dip", ar: "ديبس على كرسي", group: "triceps",
    primary: "Triceps", secondary: "Front Delts, Chest", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["اسند إيديك على حافة كرسي ثابت ورجليك قدامك.", "انزل بالمرفقين لحد ما يبقوا حوالين 90 درجة.", "ادفع لفوق لحد مد الذراعين."],
    mistakes: ["النزول أكتر من اللازم وإجهاد الكتف.", "فتح المرفقين للجانبين."],
    tips: ["اثني الركب لو كان صعب.", "تأكد إن الكرسي ثابت ومش هيتحرك."],
  }),

  ExDB({
    id: "doorframe-row", en: "Doorframe Row", ar: "تجديف بإطار الباب", group: "back",
    primary: "Mid Back", secondary: "Lats, Biceps", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["امسك إطار باب ثابت بالإيدين (أو فوطة مربوطة بقفل الباب).", "ميل جسمك للخلف بقدمين ثابتين واسحب نفسك ناحية الباب.", "ارجع ببطء مع التحكم."],
    mistakes: ["استخدام باب غير ثابت أو غير مغلق.", "كسر الجسم من الوسط أثناء السحب."],
    tips: ["اتأكد إن الباب يتفتح للجهة اللي بعيد عنك وإنه مقفول بإحكام.", "كل ما ميلت أكتر زادت الصعوبة."],
  }),

  ExDB({
    id: "prone-y-raise", en: "Prone Y Raise", ar: "رفع Y على البطن", group: "shoulders",
    primary: "Rear Delts, Lower Traps", secondary: "Mid Back", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على بطنك والذراعين مفرودين في شكل Y.", "ارفع الذراعين عن الأرض مع ضم لوحي الكتف.", "انزل ببطء."],
    mistakes: ["رفع الراس أو الرقبة لفوق.", "تقويس أسفل الضهر."],
    tips: ["الإبهام لفوق بيحسن التفعيل.", "تمرين خفيف مناسب لتحسين وضعية الكتف."],
  }),

  ExDB({
    id: "isometric-towel-curl", en: "Isometric Towel Curl", ar: "باي بالفوطة", group: "biceps",
    primary: "Biceps", secondary: "Brachialis", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["قف على منتصف فوطة وامسك الطرفين.", "اسحب الفوطة لفوق كأنك بتعمل كيرل مع مقاومة بالرجل.", "اثبت 3-5 ثواني عند أقصى انقباض ثم ارجع."],
    mistakes: ["الشد بالكتف أو الضهر.", "حبس النفس."],
    tips: ["بيعمل شغل حقيقي للباي من غير أدوات.", "مجال زيادة الحمل محدود، فزود وقت الثبات."],
  }),

  ExDB({
    id: "bodyweight-squat", en: "Bodyweight Squat", ar: "سكوات بوزن الجسم", group: "quads",
    primary: "Quads", secondary: "Glutes, Hamstrings", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["قف بقدمين بعرض الكتف وصدر مرفوع.", "انزل لحد ما الفخذ يوازي الأرض مع ركب في اتجاه القدم.", "ادفع بكعبك لفوق."],
    mistakes: ["انهيار الركب للداخل.", "رفع الكعب من الأرض."],
    tips: ["ابطّئ النزول (3 ثواني) لزيادة الصعوبة.", "مناسب لأي مكان وأي مستوى."],
  }),

  ExDB({
    id: "reverse-lunge", en: "Reverse Lunge", ar: "لانج للخلف", group: "quads",
    primary: "Quads, Glutes", secondary: "Hamstrings", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["قف مستقيم وخد خطوة للخلف برجل واحدة.", "انزل لحد ما الركبة الخلفية تقرب الأرض.", "ادفع بالرجل الأمامية للرجوع."],
    mistakes: ["الركبة الأمامية تعدي أصابع القدم بزيادة.", "الميل بالجسم لقدام."],
    tips: ["أسهل على الركبة من اللانج للأمام.", "امسك حقيبة ظهر مليانة لزيادة الحمل."],
  }),

  ExDB({
    id: "slider-hamstring-curl", en: "Slider Hamstring Curl", ar: "ليج كيرل بالانزلاق", group: "hamstrings",
    primary: "Hamstrings", secondary: "Glutes, Calves", equipment: "Bodyweight", difficulty: "Intermediate",
    instructions: ["استلقي على ضهرك وكعبيك على فوطة أو شراب على أرض ناعمة.", "ارفع الحوض ثم اسحب الكعبين ناحية جسمك.", "افرد الرجلين ببطء مع الحفاظ على الحوض مرتفع."],
    mistakes: ["هبوط الحوض أثناء الحركة.", "الحركة السريعة."],
    tips: ["ممتاز كبديل منزلي لليج كيرل.", "ابدأ بالرجلين مع بعض ثم جرب رجل واحدة."],
  }),

  ExDB({
    id: "bent-knee-calf-raise", en: "Bent-Knee Calf Raise", ar: "سمانة بركب مثنية", group: "calves",
    primary: "Soleus", secondary: "Gastrocnemius", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["قف على حافة درجة مع ثني الركبتين شوية.", "ارفع الكعب لأقصى ارتفاع.", "انزل ببطء لتحت مستوى الدرجة."],
    mistakes: ["فرد الركب أثناء الحركة.", "مدى حركة قصير."],
    tips: ["ثني الركبة بيخلي السولس هي الشغالة أكتر.", "امسك حقيبة ظهر مليانة لزيادة الحمل."],
  }),

  ExDB({
    id: "side-lying-leg-raise", en: "Side-Lying Leg Raise", ar: "رفع الرجل جانبًا", group: "glutes",
    primary: "Glute Medius", secondary: "Glute Max, TFL", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على جنبك والرجلين على بعض.", "ارفع الرجل العلوية للجنب مع ثبات الحوض.", "انزل ببطء."],
    mistakes: ["دوران الحوض للخلف.", "رفع الرجل لأعلى من اللازم."],
    tips: ["رجلك العلوية ممدودة وإبهامك مايل لتحت.", "كرر 15-20 مرة لكل جانب."],
  }),

  ExDB({
    id: "donkey-kick", en: "Donkey Kick", ar: "دونكي كيك", group: "glutes",
    primary: "Glutes", secondary: "Hamstrings", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["ابدأ على أربع، الركبتين تحت الحوض.", "ارفع رجل واحدة مثنية لفوق مع عصر الجلوت.", "انزل بتحكم."],
    mistakes: ["تقويس أسفل الضهر.", "فتح الورك للجانب."],
    tips: ["الحركة صغيرة من الورك مش من الضهر.", "أضف حزام فوق الركب لزيادة الصعوبة."],
  }),

  ExDB({
    id: "crunch", en: "Crunch", ar: "كرانش", group: "core",
    primary: "Abs", secondary: "Obliques", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على ضهرك والركب مثنية والإيدين جنب الراس.", "ارفع الكتفين عن الأرض بتقوس البطن.", "انزل ببطء."],
    mistakes: ["شد الرقبة بالإيدين.", "رفع الجذع كله بدل أعلى الضهر."],
    tips: ["ركز على تقريب القفص الصدري من الحوض.", "الحركة صغيرة ومتحكمة أفضل من حركة كبيرة سريعة."],
  }),

  ExDB({
    id: "bird-dog", en: "Bird Dog", ar: "بيرد دوج", group: "core",
    primary: "Core, Lower Back (stability)", secondary: "Glutes, Shoulders", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["ابدأ على أربع بجذع مستقيم.", "مد ذراع وارجل عكسها لحد الاستقامة.", "ارجع وغيّر الجهة."],
    mistakes: ["دوران الحوض أو الجذع.", "رفع الرجل أعلى من الظهر."],
    tips: ["تخيل إن كوب ماء على ضهرك ما يقعش.", "اثبت 2-3 ثواني عند الفرد."],
  }),

  ExDB({
    id: "incline-db-fly", en: "Incline Dumbbell Fly", ar: "فلاي إنكلاين بدمبلز", group: "chest",
    primary: "Upper Chest", secondary: "Front Delts", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["اضبط البنش بزاوية 30 درجة تقريبًا وامسك دمبلز فوق صدرك.", "افتح الذراعين في قوس مع ثني بسيط في المرفق.", "اجمع الدمبلز فوق الصدر بنفس القوس."],
    mistakes: ["ثني المرفق أكتر وتحويلها لضغط.", "النزول أكتر من اللازم وإجهاد الكتف."],
    tips: ["وزن خفيف مع تحكم أفضل من وزن تقيل.", "بديل للـ Low-to-High Cable Fly لو الكابل مش متاح."],
  }),

  ExDB({
    id: "decline-db-press", en: "Decline Dumbbell Press", ar: "ضغط دمبلز ديكلاين", group: "chest",
    primary: "Lower Chest", secondary: "Triceps, Front Delts", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["اضبط البنش بميل بسيط لتحت وثبّت رجليك.", "انزل بالدمبلز لجانب أسفل الصدر.", "ادفع لفوق لحد مد الذراعين."],
    mistakes: ["الميل الزايد في البنش.", "فتح المرفقين بزيادة."],
    tips: ["بديل للبنش ديكلاين لو البار مش متاح.", "اطلب مساعد لتسليم الدمبلز."],
  }),

  ExDB({
    id: "close-grip-db-press", en: "Close-Grip Dumbbell Press", ar: "ضغط دمبلز ضيق", group: "triceps",
    primary: "Triceps", secondary: "Chest, Front Delts", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["استلقي على بنش وضم الدمبلز لبعض فوق الصدر.", "انزل بالمرفقين قريبين من الجسم.", "ادفع لفوق مع عصر الدمبلز لبعضهم."],
    mistakes: ["فتح المرفقين للخارج.", "ترك الدمبلز يبعدوا عن بعض."],
    tips: ["عصر الدمبلز لبعض يزيد تفعيل الترايسبس.", "بديل للـ Close-Grip Bench لو البار مش متاح."],
  }),

  ExDB({
    id: "dumbbell-skull-crusher", en: "Dumbbell Skull Crusher", ar: "سكال كراشر بدمبلز", group: "triceps",
    primary: "Triceps", secondary: "Forearms", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["استلقي على بنش وامسك دمبلز فوق الصدر بذراعين مفرودين.", "اثني المرفقين وانزل الدمبلز ناحية جنب الراس.", "افرد المرفقين للرجوع."],
    mistakes: ["تحريك العضد أثناء الحركة.", "فتح المرفقين للجانبين."],
    tips: ["المسك المحايد (كفوف لبعض) أرحم للمرفق.", "ابدأ بوزن خفيف لحماية المرفق."],
  }),

  ExDB({
    id: "cable-rope-hammer-curl", en: "Cable Rope Hammer Curl", ar: "هامر كيرل بحبل كيبل", group: "biceps",
    primary: "Biceps, Brachialis", secondary: "Forearms", equipment: "Cable", difficulty: "Beginner",
    instructions: ["ثبّت حبل على البكرة السفلية وامسكه بكفوف متقابلة.", "اثني المرفقين لحد الكتف مع ثبات العضد.", "ارجع ببطء مع الحفاظ على الشد."],
    mistakes: ["تحريك المرفقين لقدام.", "التأرجح بالجذع."],
    tips: ["الشد المستمر من الكيبل مميز عن الدمبلز.", "بديل مناسب للهامر كيرل بالدمبلز."],
  }),

  ExDB({
    id: "dumbbell-reverse-wrist-curl", en: "Dumbbell Reverse Wrist Curl", ar: "رسغ عكسي بدمبل", group: "forearms",
    primary: "Forearm Extensors", secondary: "Brachioradialis", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["اسند الساعد على فخذك أو بنش والكف لتحت.", "ارفع الرسغ لفوق بتحكم.", "انزل ببطء لمدى كامل."],
    mistakes: ["تحريك الساعد مع الحركة.", "وزن تقيل ومدى حركة قصير."],
    tips: ["وزن خفيف وعدّات 15-20 كفاية.", "بديل للبار لو مفيش بار متاح."],
  }),

  ExDB({
    id: "dumbbell-reverse-curl", en: "Dumbbell Reverse Curl", ar: "ريفرس كيرل بدمبلز", group: "forearms",
    primary: "Brachioradialis, Forearm Extensors", secondary: "Biceps", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبلز بكفوف لتحت (مسكة مقلوبة).", "اثني المرفقين لحد الكتف مع ثبات العضد.", "انزل ببطء."],
    mistakes: ["ثني الرسغ بدل ثبات الرسغ.", "التأرجح بالجسم."],
    tips: ["وزن أخف من الكيرل العادي.", "ممتاز لتقوية الساعد والمسك."],
  }),

  ExDB({
    id: "seated-dumbbell-calf-raise", en: "Seated Dumbbell Calf Raise", ar: "سمانة جالس بدمبل", group: "calves",
    primary: "Soleus", secondary: "Gastrocnemius", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["اقعد وضع دمبل فوق الركبة أو الفخذ.", "ارفع الكعب لأقصى ارتفاع.", "انزل ببطء لمدى كامل."],
    mistakes: ["مدى حركة قصير.", "ارتداد سريع بدون تحكم."],
    tips: ["حط درجة تحت أصابع القدم لمدى أكبر.", "بديل للـ Seated Calf Raise لو الجهاز مش متاح."],
  }),

  ExDB({
    id: "captains-chair-leg-raise", en: "Captain's Chair Leg Raise", ar: "رفع رجل في كرسي الكابتن", group: "core",
    primary: "Lower Abs", secondary: "Hip Flexors", equipment: "Machine", difficulty: "Intermediate",
    instructions: ["اسند ضهرك على الكرسي والإيدين على المساند.", "ارفع الركب أو الرجلين لحد مستوى الحوض أو أعلى.", "انزل ببطء بدون تأرجح."],
    mistakes: ["تأرجح الجسم.", "الاعتماد على الورك بدل البطن."],
    tips: ["اقلب الحوض لفوق في نهاية الرفع.", "أسهل وأكثر ثباتًا من الرفع المعلق."],
  }),

  ExDB({
    id: "machine-crunch", en: "Machine Crunch", ar: "كرانش بالجهاز", group: "core",
    primary: "Abs", secondary: "Obliques", equipment: "Machine", difficulty: "Beginner",
    instructions: ["اقعد على الجهاز وضبط الوزن وامسك المقابض.", "اثني الجذع لتحت بتقوس البطن.", "ارجع ببطء مع الحفاظ على الشد."],
    mistakes: ["السحب بالذراعين بدل البطن.", "اختيار وزن زائد على حساب الشكل."],
    tips: ["تنفس للخارج أثناء الثني.", "بديل للـ Cable Crunch لو الكيبل مش متاح."],
  }),

  ExDB({
    id: "cable-woodchop", en: "Cable Woodchop", ar: "وودتشوب بالكيبل", group: "core",
    primary: "Obliques", secondary: "Abs, Shoulders", equipment: "Cable", difficulty: "Intermediate",
    instructions: ["ثبّت الكيبل في أعلى أو أسفل وامسكه بإيدين.", "لف الجذع عبر الجسم بحركة قطرية.", "ارجع بتحكم."],
    mistakes: ["السحب بالذراعين بدل الجذع.", "دوران الركب."],
    tips: ["الحركة من الجذع مش من الإيدين.", "جرب الاتجاهين: من تحت لفوق ومن فوق لتحت."],
  }),

  ExDB({
    id: "suitcase-carry", en: "Suitcase Carry", ar: "حمل الشنطة", group: "forearms",
    primary: "Grip, Obliques", secondary: "Traps, Core", equipment: "Dumbbell", difficulty: "Beginner",
    instructions: ["امسك دمبل تقيل في إيد واحدة جنبك.", "امشي بجذع مستقيم من غير ميل للجنب.", "غيّر الإيد بعد المسافة."],
    mistakes: ["الميل للجنب لتعويض الوزن.", "رفع الكتف."],
    tips: ["بيقوي المسك والجانب البطني مع بعض.", "حط وزن تقيل بما يكفي لتحدي المسك."],
  }),

  ExDB({
    id: "band-shrug", en: "Band Shrug", ar: "شراج بالحزام", group: "traps",
    primary: "Upper Traps", secondary: "Levator Scapulae, Forearms", equipment: "Band", difficulty: "Beginner",
    instructions: ["قف على منتصف الحزام وامسك الطرفين بجنبك.", "ارفع الكتفين لفوق ناحية الأذن بدون ثني المرفقين.", "انزل ببطء لمدى كامل."],
    mistakes: ["تدوير الكتفين بدل رفعهم لفوق.", "ثني المرفقين لتعويض الحزام."],
    tips: ["اثبت ثانية فوق عشان تزود الشد.", "بديل عملي للشراج بالدمبلز لما مفيش أوزان."],
  }),

  ExDB({
    id: "backpack-shrug", en: "Backpack Shrug", ar: "شراج بشنطة الضهر", group: "traps",
    primary: "Upper Traps", secondary: "Forearms", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["املأ شنطة ضهر بكتب أو زجاجات مياه وامسكها بإيد أو إيدين بجنبك.", "ارفع الكتفين لفوق ناحية الأذن.", "انزل ببطء مع التحكم."],
    mistakes: ["ثني المرفقين أثناء الرفع.", "استخدام وزن خفيف جدًا على غير الحاجة."],
    tips: ["زوّد الوزن بإضافة كتب أو مياه.", "بديل منزلي لشراج الدمبلز."],
  }),

  ExDB({
    id: "bottle-lateral-raise", en: "Bottle Lateral Raise", ar: "رفرفة جانبية بزجاجتين", group: "shoulders",
    primary: "Side Delts", secondary: "Front Delts, Traps", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["امسك زجاجتين مياه أو جركنين صغيرين بجنبك.", "ارفع الذراعين للجانب لحد مستوى الكتف.", "انزل ببطء بدون تأرجح."],
    mistakes: ["رفع الكتفين لفوق بدل الذراعين.", "التأرجح بالجسم."],
    tips: ["عدّات كتير (15-25) تعوض خفة الوزن.", "ابطّئ النزول (3 ثواني) لزيادة الصعوبة."],
  }),

  ExDB({
    id: "dumbbell-pullover", en: "Dumbbell Pullover", ar: "بول أوفر بدمبل", group: "back",
    primary: "Lats", secondary: "Chest, Triceps (long head)", equipment: "Dumbbell", difficulty: "Intermediate",
    instructions: ["استلقي بعرض على بنش وامسك دمبل بالإيدين فوق الصدر.", "انزل الدمبل خلف الراس بذراعين شبه مفرودين لحد ما تحس بإطالة في الجنب.", "اسحب الدمبل لفوق الصدر بالتحكم من اللاتس."],
    mistakes: ["ثني المرفقين أكتر وتحويلها لإكستنشن ترايسبس.", "تقويس الضهر على البنش."],
    tips: ["اختار دمبل بوزن يسمح بالتحكم الكامل.", "بديل لعزل اللاتس لو مفيش كابل."],
  }),

  ExDB({
    id: "prone-lat-pulldown", en: "Prone Lat Pulldown", ar: "سحب لاتس على البطن", group: "back",
    primary: "Lats", secondary: "Rear Delts, Lower Traps", equipment: "Bodyweight", difficulty: "Beginner",
    instructions: ["استلقي على بطنك والذراعين مفرودين فوق الراس.", "اسحب المرفقين لجنبك كأنك بتعمل بول داون مع رفع الصدر شوية.", "ارجع ببطء مع التحكم."],
    mistakes: ["رفع الراس والرقبة لفوق.", "تقويس أسفل الضهر."],
    tips: ["اثبت ثانية عند ضم لوحي الكتف.", "بديل منزلي لسحب اللاتس بدون أدوات."],
  }),

];

export { ExDB, MUSCLE_GROUPS, EQUIPMENT_TYPES, EQUIPMENT_LABELS, EXERCISES };
