/**
 * data.js — Content Data Module
 * ---------------------------------------------------------------
 * Single source of truth for every exercise, education card,
 * recovery tip, nutrition fact, and injury guideline shown in the app.
 *
 * To add a new exercise: push a new Ex({...}) object into the
 * relevant array. To add a new day: add a new `dayN` entry to DATA
 * and register it in navigation.js + js/app.js PAGES map.
 *
 * Nothing in this file touches the DOM — it is pure content.
 * ---------------------------------------------------------------
 */
import { icon, colorDot } from "./icons.js";

// ---- helper builder: keeps exercise entries short & consistent ----
function Ex(o){
  // defaults so every card can render safely even if a field is skipped
  return Object.assign({
    primary:"", secondary:"", stabilizers:"", tempo:"2-0-1", rest:"60-90 ث",
    rpe:"RPE 7-8", cue:"", mistake:"", why:"", prog:"", reg:"",
    difficulty:"Intermediate", vid:null,
    // Ready for population once a verified source is available — never
    // auto-generated from the exercise name (see ui.js mediaHtml/illustrationLink).
    mwUrl:null, gif:null
  }, o);
}

// ---- helper builder: a Workout Day's *reference* to a shared Exercise
// Library entry (exercises-data.js), plus this program's own prescription
// for it (sets/tempo/rest/rpe/coaching notes). This is intentionally NOT
// a full exercise record — no name, muscle group, or illustration lives
// here. Those all come from the single EXERCISES source of truth at
// render time (see workout.js `resolveDayExercise`), so a Day never
// carries a second, driftable copy of exercise identity data.
//   id  — must match an `id` in exercises-data.js EXERCISES exactly.
//   vid — OPTIONAL manually-verified YouTube id, carried over only for
//         the handful of exercises that already had one in the original
//         curated 3-day program (see ui.js tutorialLink). Never invented;
//         omitted entirely (falls back to a live YouTube search) for the
//         rest.
function DayEx(o){
  return Object.assign({
    id:"", sets:"", tempo:"2-0-1", rest:"60-90 ث", rpe:"RPE 7-8",
    stabilizers:"", cue:"", mistake:"", why:"", prog:"", reg:"", vid:null
  }, o);
}

const YT_SEARCH = (q)=> `https://www.youtube.com/results?search_query=${encodeURIComponent(q+" exercise form tutorial")}`;
const MW_SEARCH = (q)=> `https://www.google.com/search?q=${encodeURIComponent(q+" site:musclewiki.com")}`;

const DATA = {

/* ---------------- GENERAL WARM-UP (cardio, same for every day) --------- */
generalWarmup:[
  {en:"Incline Walk", ar:"مشي مائل", dur:"5-7 دقايق", note:"سرعة هادئة، الميل يرفع نبضك بسرعة من غير إجهاد الركبة.", illustration:"https://fitnessprogramer.com/warm-up-exercises/", neglected:"الدورة الدموية العامة — إحماء تدريجي بيقلل خطر إصابة العضلات الباردة."},
  {en:"Stationary Bike", ar:"عجلة ثابتة", dur:"5-7 دقايق", note:"بديل ممتاز لو فيه أي تحسس في الركبة.", illustration:"https://fitnessprogramer.com/warm-up-exercises/", neglected:"الدورة الدموية والركبة — بديل منخفض الصدمة لو فيه تحسس."},
  {en:"Rowing Machine", ar:"روينج", dur:"5 دقايق", note:"بيسخن الجسم كله (upper + lower) في وقت واحد.", illustration:"https://www.onepeloton.com/blog/rowing-machine-warm-up", neglected:"الجسم كله (Upper + Lower) في وقت واحد."},
  {en:"Jump Rope (اختياري)", ar:"نط الحبل", dur:"3-5 دقايق", note:"اختياري لو حابب حاجة أعلى شدة، مش لازم كل مرة.", illustration:"https://www.acefitness.org/resources/everyone/blog/5408/calorie-burning-jump-rope-workout/", neglected:"التوافق العصبي العضلي والكاحل — تحفيز أعلى شدة اختياري."}
],

/* ---------------- MOBILITY + ACTIVATION (per day-type) ------------------ */
mobility:{
  full:[
    Ex({en:"Cat Camel", ar:"قطة وجمل", primary:"العمود الفقري", sets:"1×10 عدات ببطء", cue:"تحرك مع نفسك، مطرحش تسرع.", why:"يفك العمود الفقري كله ويجهزه للحمل — مهم في يوم فيه رفعة وسحب وضغط مع بعض.", illustration:"https://www.rehabhero.ca/exercise/cat-camel", neglected:"عضلات العمود الفقري العميقة (Multifidus) اللي بتتهمل بسبب الجلوس الطويل."}),
    Ex({en:"Thread the Needle", ar:"تمرير الإبرة", primary:"الظهر العلوي / الصدر", sets:"6 لكل جانب", cue:"دوران من الصدر مش من الرقبة.", why:"يحسن دوران الجذع ويفتح الصدر — يساعد ضد انحناء الكتف للأمام.", illustration:"https://fitnessdrum.com/thread-the-needle-stretch/", neglected:"عضلات الظهر العلوي ودوران الصدر اللي بتقل حركتها من قعدة المكتب."}),
    Ex({en:"Hip CARs", ar:"دوران الورك الكامل", primary:"مفصل الورك", sets:"5 لكل جانب", cue:"حركة دائرية بطيئة وواسعة قد ما تقدر.", why:"يحسن مدى حركة الورك قبل أي سكوات أو هينج في نفس اليوم.", illustration:"https://spotebi.com/exercise-guide/hip-circles/", neglected:"عضلات الورك العميقة (Deep Rotators) اللي مبتتشتغلش في التمارين العادية."}),
    Ex({en:"World's Greatest Stretch", ar:"أفضل شد في العالم", primary:"الورك + الصدر", sets:"5 لكل جانب", cue:"لانج عميق مع دوران للجذع فوق.", why:"يفتح الورك والصدر مع بعض في حركة واحدة — تسخين شامل مثالي ليوم Full Body.", illustration:"https://www.muscleandstrength.com/exercises/worlds-greatest-stretch", neglected:"الورك والصدر مع بعض — أكتر منطقتين بتتشد من قعدة المكتب."}),
    Ex({en:"Shoulder CARs", ar:"دوران الكتف الكامل", primary:"محفظة الكتف", sets:"5 لكل جانب", cue:"أبطأ حركة ممكنة، حافظ على أقصى مدى.", why:"يحسن صحة مفصل الكتف قبل تمارين الدفع والسحب.", illustration:"https://liftmanual.com/arm-circles/", neglected:"الكبسولة المفصلية للكتف اللي بيضعف مداها مع تكرار حركة واحدة بس."}),
    Ex({en:"Walking Lunges", ar:"لانج مشي", primary:"Quads / Glutes", sets:"10 لكل رجل", cue:"خطوة واسعة، ركبة قريبة من الأرض.", why:"تسخين ديناميكي بيحاكي حركة السكوات/الهينج.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/94/forward-lunge/", neglected:"عضلات الاستقرار أحادية الرجل اللي بتضعف مع تمارين ثنائية الرجل بس."}),
    Ex({en:"90/90 Hip Rotation", ar:"دوران الورك 90/90", primary:"عضلات الورك العميقة", sets:"8 لكل جانب", cue:"حركة بطيئة، الجذع ثابت.", why:"يحسن الدوران الداخلي/الخارجي للورك — مهم للانج البلغاري والسكوات.", illustration:"https://www.healthline.com/health/hip-exercises", neglected:"الدوران الداخلي/الخارجي للورك، أكتر مدى حركة بيتأثر بالجلوس الطويل."}),
    Ex({en:"Wrist Circles + Wrist Rocks", ar:"دوران ومط الرسغ", primary:"الرسغ", sets:"10 لكل اتجاه + 8 مط", cue:"دوائر بطيئة، وبعدين إيدك على الأرض واتمايل لقدام ولورا.", why:"يجهز الرسغ لتحمل وزن الجسم/البار في تمارين الدفع والسكوات الأمامي.", illustration:"https://hrs.byu.edu/stretching/warmups", neglected:"الرسغ، بيتهمل غالبًا لحد ما يحصل ألم تحت حمل البار."}),
    Ex({en:"Ankle CARs / Rocks", ar:"دوران وتمايل الكاحل", primary:"الكاحل", sets:"8 لكل اتجاه", cue:"ركبتك فوق أصابعك في التمايل، الكعب ملازم الأرض.", why:"مدى حركة الكاحل المحدود بيغير فورم السكوات بالكامل — أهمله كتير من اللاعبين.", illustration:"https://hrs.byu.edu/stretching/warmups", neglected:"مدى حركة الكاحل، أهم عامل مهمل بيأثر على فورم السكوات."}),
    Ex({en:"Thoracic Rotation (Quadruped)", ar:"دوران أعلى الظهر", primary:"العمود الفقري العلوي", sets:"6 لكل جانب", cue:"إيدك على قفاك ودور بالكوع لفوق من الصدر بس.", why:"يحسن دوران أعلى الظهر المهم لكل حركات السحب والضغط — بيقلل الاعتماد على الكتف والرقبة.", illustration:"https://fitnessdrum.com/thread-the-needle-stretch/", neglected:"دوران أعلى الظهر، بيقل مع الجلوس الطويل قدام الشاشة."})
  ],
  upper:[
    Ex({en:"Cat Camel", ar:"قطة وجمل", primary:"العمود الفقري", sets:"1×10 عدات ببطء", cue:"تحرك مع نفسك، مطرحش تسرع.", why:"يفك العمود الفقري ويجهزه للحمل فوق الرأس.", illustration:"https://www.rehabhero.ca/exercise/cat-camel", neglected:"عضلات العمود الفقري العميقة (Multifidus) اللي بتتهمل بسبب الجلوس الطويل."}),
    Ex({en:"Thread the Needle", ar:"تمرير الإبرة", primary:"الظهر العلوي / الصدر", sets:"6 لكل جانب", cue:"دوران من الصدر مش من الرقبة.", why:"يحسن دوران الجذع اللازم لتمارين السحب والدفع.", illustration:"https://fitnessdrum.com/thread-the-needle-stretch/", neglected:"عضلات الظهر العلوي ودوران الصدر اللي بتقل حركتها من قعدة المكتب."}),
    Ex({en:"Arm Circles", ar:"دوائر الذراع", primary:"الكتف", sets:"10 لكل اتجاه", cue:"دوائر واسعة وبطيئة الأول، بعدين أسرع شوية.", why:"يسخن مفصل الكتف ويزود الدم فيه.", illustration:"https://www.muscleandstrength.com/exercises/arm-circles", neglected:"الكتف الخلفي والدوران الخارجي، بيتهمل قدام تمارين الدفع."}),
    Ex({en:"Shoulder CARs", ar:"دوران الكتف الكامل", primary:"محفظة الكتف", sets:"5 لكل جانب", cue:"أبطأ حركة ممكنة، حافظ على أقصى مدى.", why:"يحسن صحة مفصل الكتف على المدى الطويل.", illustration:"https://liftmanual.com/arm-circles/", neglected:"الكبسولة المفصلية للكتف اللي بيضعف مداها مع تكرار حركة واحدة بس."}),
    Ex({en:"Band Pull Apart", ar:"شد الحزام", primary:"Rear Delts / الظهر العلوي", sets:"2×15", cue:"افتح صدرك وقرب لوحي الكتف.", why:"تنشيط للظهر العلوي قبل تمارين الدفع (يوازن الكتف)."})
  ],
  lower:[
    Ex({en:"Hip CARs", ar:"دوران الورك الكامل", primary:"مفصل الورك", sets:"5 لكل جانب", cue:"حركة دائرية بطيئة وواسعة قد ما تقدر.", why:"يحسن مدى حركة الورك، أهم عامل قبل السكوات والرفعات.", illustration:"https://spotebi.com/exercise-guide/hip-circles/", neglected:"عضلات الورك العميقة (Deep Rotators) اللي مبتتشتغلش في التمارين العادية."}),
    Ex({en:"World's Greatest Stretch", ar:"أفضل شد في العالم", primary:"الورك + الخط الخلفي للرجل", sets:"5 لكل جانب", cue:"لانج عميق مع دوران للجذع فوق.", why:"يفتح الورك والصدر مع بعض في حركة واحدة.", illustration:"https://www.muscleandstrength.com/exercises/worlds-greatest-stretch", neglected:"الورك والصدر مع بعض — أكتر منطقتين بتتشد من قعدة المكتب."}),
    Ex({en:"90/90 Hip Rotation", ar:"دوران الورك 90/90", primary:"عضلات الورك العميقة", sets:"8 لكل جانب", cue:"حركة بطيئة، الجذع ثابت.", why:"يحسن الدوران الداخلي/الخارجي للورك.", illustration:"https://www.healthline.com/health/hip-exercises", neglected:"الدوران الداخلي/الخارجي للورك، أكتر مدى حركة بيتأثر بالجلوس الطويل."}),
    Ex({en:"Walking Lunges", ar:"لانج مشي", primary:"Quads / Glutes", sets:"10 لكل رجل", cue:"خطوة واسعة، ركبة قريبة من الأرض.", why:"تسخين ديناميكي بيحاكي حركة السكوات.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/94/forward-lunge/", neglected:"عضلات الاستقرار أحادية الرجل اللي بتضعف مع تمارين ثنائية الرجل بس."}),
    Ex({en:"Bodyweight Squats", ar:"سكوات بوزن الجسم", primary:"Quads / Glutes", sets:"12-15", cue:"ركبتين لبره على خط القدم، نزول كامل.", why:"يجهز الجسم لنمط الحركة قبل الأوزان.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/", neglected:"أنماط الحركة قبل التحميل — بيتهمل لصالح الإحماء الثابت بس."})
  ]
},
activation:{
  full:[
    Ex({en:"Face Pull", ar:"سحب للوجه", primary:"Rear Delts / الظهر العلوي", sets:"2×15", cue:"اسحب الحبل لوشك مع فتح المرفقين.", why:"ينشط عضلات مضادة لانحناء الكتف للأمام (Rounded Shoulders) — أهم تمرين تنشيطي في اليوم.", illustration:"https://www.muscleandstrength.com/exercises/cable-face-pull", neglected:"الكتف الخلفي (Rear Delts) والدوارة الكتفية، أكتر عضلة مهملة عند اللي بيركزوا على الدفع بس."}),
    Ex({en:"Band Pull Apart", ar:"شد الحزام", primary:"Rear Delts / الظهر العلوي", sets:"2×15", cue:"افتح صدرك وقرب لوحي الكتف.", why:"تنشيط سريع للظهر العلوي قبل تمارين الدفع، يوازن الكتف."}),
    Ex({en:"Glute Bridge", ar:"جسر الجلوت", primary:"Glutes", sets:"2×12", cue:"اعصر الجلوت فوق لثانية.", why:"تنشيط الجلوت قبل أي سكوات أو هينج — بيقلل اعتماد أسفل الظهر ويدعم تصحيح APT.", illustration:"https://musclewiki.com/exercise/glute-bridge", neglected:"الجلوت، بيتهمل لصالح أسفل الظهر في تمارين الرفع."}),
    Ex({en:"Dead Bug", ar:"تنشيط الكور", primary:"عمق البطن", sets:"2×10 لكل جانب", cue:"ضهرك ملزق بالأرض طول الوقت.", why:"يثبت الحوض قبل الحمل، مهم جدًا لتصحيح APT قبل أي رفعة تقيلة.", illustration:"https://musclewiki.com/exercise/dead-bug", neglected:"عمق البطن (Transverse Abdominis)، بيتهمل لصالح تمارين الكرنش السطحية."}),
    Ex({en:"Scapular Pull-ups", ar:"سحب لوح الكتف", primary:"الظهر العلوي / Serratus", sets:"2×8", cue:"من غير ثني المرفق، حرك لوح الكتف بس.", why:"ينشط عضلات التحكم في لوح الكتف قبل تمارين السحب والضغط.", illustration:"https://www.rehabhero.ca/exercise/scapular-pull-ups", neglected:"عضلات التحكم في لوح الكتف، بتتهمل قبل تمارين السحب الثقيلة."}),
    Ex({en:"Mini Band Walk", ar:"مشي بالحزام", primary:"Glute Medius", sets:"2×10 خطوة لكل جانب", cue:"ركبتين مضغوطين للخارج على الحزام طول الوقت.", why:"ينشط عضلات جانب الحوض المهملة غالبًا قبل السكوات/اللانج.", illustration:"https://www.muscleandstrength.com/exercises/lateral-band-walk", neglected:"Glute Medius على جانب الحوض، بيتهمل قدام الجلوت الأساسي."})
  ],
  upper:[
    Ex({en:"Face Pull", ar:"سحب للوجه", primary:"Rear Delts / الظهر العلوي", sets:"2×15", cue:"اسحب الحبل لوشك مع فتح المرفقين.", why:"ينشط عضلات مضادة لانحناء الكتف للأمام (Rounded Shoulders).", illustration:"https://www.muscleandstrength.com/exercises/cable-face-pull", neglected:"الكتف الخلفي (Rear Delts) والدوارة الكتفية، أكتر عضلة مهملة عند اللي بيركزوا على الدفع بس."}),
    Ex({en:"Band External Rotation", ar:"دوران خارجي بالحزام", primary:"Rotator Cuff", sets:"2×12 لكل جانب", cue:"المرفق ثابت جنب جسمك.", why:"يحمي مفصل الكتف ويجهزه لتمارين الضغط.", illustration:"https://www.muscleandstrength.com/exercises/single-arm-banded-external-rotation", neglected:"الدوارة الكتفية الخارجية (Infraspinatus/Teres Minor)، أضعف عضلة عند غالبية الناس."}),
    Ex({en:"Scapular Pull-ups", ar:"سحب لوح الكتف", primary:"الظهر العلوي / Serratus", sets:"2×8", cue:"من غير ثني المرفق، حرك لوح الكتف بس.", why:"ينشط عضلات التحكم في لوح الكتف قبل تمارين السحب.", illustration:"https://www.rehabhero.ca/exercise/scapular-pull-ups", neglected:"عضلات التحكم في لوح الكتف، بتتهمل قبل تمارين السحب الثقيلة."}),
    Ex({en:"Wall Slides", ar:"انزلاق الحيطة", primary:"الكتف / الظهر العلوي", sets:"2×10", cue:"ضهرك وإيديك ملزقين الحيطة طول الحركة.", why:"يحسن مدى حركة الكتف فوق الرأس ووضعية الصدر.", illustration:"https://www.muscleandstrength.com/exercises/scapular-wall-slide", neglected:"الترابيز السفلي والتحكم في دوران لوح الكتف فوق الرأس."})
  ],
  lower:[
    Ex({en:"Glute Bridge", ar:"جسر الجلوت", primary:"Glutes", sets:"2×12", cue:"اعصر الجلوت فوق لثانية.", why:"تنشيط الجلوت أساسي قبل أي تمرين رجل — بيقلل اعتماد أسفل الظهر.", illustration:"https://musclewiki.com/exercise/glute-bridge", neglected:"الجلوت، بيتهمل لصالح أسفل الظهر في تمارين الرفع."}),
    Ex({en:"Dead Bug", ar:"تنشيط الكور", primary:"عمق البطن", sets:"2×10 لكل جانب", cue:"ضهرك ملزق بالأرض طول الوقت.", why:"يثبت الحوض قبل الحمل، مهم جدًا لتصحيح APT.", illustration:"https://musclewiki.com/exercise/dead-bug", neglected:"عمق البطن (Transverse Abdominis)، بيتهمل لصالح تمارين الكرنش السطحية."}),
    Ex({en:"Bird Dog", ar:"بيرد دوج", primary:"Core / أسفل الظهر", sets:"2×10 لكل جانب", cue:"حافظ على استواء الحوض، متلفش.", why:"يبني ثبات الجذع المضاد للدوران، يحمي أسفل الظهر.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/", neglected:"ثبات الجذع المضاد للدوران، بيتهمل قدام تمارين البطن العادية."}),
    Ex({en:"Mini Band Walk", ar:"مشي بالحزام", primary:"Glute Medius", sets:"2×10 خطوة لكل جانب", cue:"ركبتين مضغوطين للخارج على الحزام طول الوقت.", why:"ينشط عضلات جانب الحوض المهملة غالبًا.", illustration:"https://www.muscleandstrength.com/exercises/lateral-band-walk", neglected:"Glute Medius على جانب الحوض، بيتهمل قدام الجلوت الأساسي."}),
    Ex({en:"Hip Airplane", ar:"طيارة الورك", primary:"Glutes / توازن", sets:"2×6 لكل جانب", cue:"حركة بطيئة ومتحكمة، استخدم حيطة للتوازن الأول.", why:"يبني تحكم وقوة في الورك بحركة أحادية الرجل.", illustration:"https://spotebi.com/exercise-guide/hip-circles/", neglected:"توازن وتحكم الورك أحادي الرجل، أهم عامل مهمل في إصابات الركبة."})
  ]
},

/* ---------------- POST-WORKOUT STRETCHING (per day-type) ---------------
 * General static stretching only — NOT posture-corrective (APT) work,
 * which stays in its own separate aptLibrary/aptEducation section by
 * design. Auto-attached after the main lifts in pageDay().
 * ------------------------------------------------------------------- */
coolDown:{
  full:[
    {en:"Doorway Chest Stretch", ar:"شد الصدر بالباب", dur:"30 ث لكل جانب", note:"إيدك على إطار الباب وميل جسمك لقدام بخفة — أهم إطالة ضد Rounded Shoulders.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/209/standing-chest-stretch/", neglected:"الصدر، أكتر عضلة بتقصر من قعدة المكتب وبتسبب Rounded Shoulders."},
    {en:"Cross-Body Shoulder Stretch", ar:"شد الكتف العرضي", dur:"30 ث لكل جانب", note:"اسحب ذراعك بهدوء عبر صدرك بالإيد التانية.", illustration:"https://www.endomondo.com/exercise/cross-body-shoulder-stretch", neglected:"الكتف الخلفي والترابيز العلوي."},
    {en:"Kneeling Hip Flexor Stretch", ar:"شد مثني الورك جاثي", dur:"30 ث لكل رجل", note:"ركبة واحدة بالأرض، ادفع الحوض لقدام بخفة من غير تقويس الظهر — أهم إطالة ضد APT.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/142/kneeling-hip-flexor-stretch/", neglected:"Hip Flexors، بتقصر بسبب الجلوس الطويل وبتسبب APT."},
    {en:"Seated Hamstring Stretch", ar:"شد الهامسترينج قاعد", dur:"30 ث لكل رجل", note:"رجل مفرودة قدامك، ميل جذعك لقدام من الورك بضهر مستقيم.", illustration:"https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848", neglected:"الهامسترينج، بيتشد قليل عند اللي بيركزوا على الكوادز بس."},
    {en:"Figure-4 Glute Stretch", ar:"شد الجلوت (فيجر 4)", dur:"30 ث لكل جانب", note:"استلقي وحط كاحلك فوق الركبة التانية، اسحب الرجل السفلية لصدرك.", illustration:"https://www.rehabhero.ca/exercise/figure-4-stretch", neglected:"الجلوت والـ Piriformis، بيتهمل قدام إطالة أسفل الظهر."},
    {en:"Lat Stretch", ar:"شد اللاتس", dur:"30 ث لكل جانب", note:"امسك حاجة ثابتة فوقك واسند بوزن جسمك للخلف والجانب.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/198/90-lat-stretch/", neglected:"اللاتس، بيتهمل مع التركيز على تمارين الصدر والكتف."}
  ],
  upper:[
    {en:"Doorway Chest Stretch", ar:"شد الصدر بالباب", dur:"30 ث لكل جانب", note:"إيدك على إطار الباب وميل جسمك لقدام بخفة لحد ما تحس بشد في الصدر.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/209/standing-chest-stretch/", neglected:"الصدر، أكتر عضلة بتقصر من قعدة المكتب وبتسبب Rounded Shoulders."},
    {en:"Cross-Body Shoulder Stretch", ar:"شد الكتف العرضي", dur:"30 ث لكل جانب", note:"اسحب ذراعك بهدوء عبر صدرك بالإيد التانية.", illustration:"https://www.endomondo.com/exercise/cross-body-shoulder-stretch", neglected:"الكتف الخلفي والترابيز العلوي."},
    {en:"Triceps Overhead Stretch", ar:"شد الترايسبس فوق الرأس", dur:"30 ث لكل جانب", note:"ارفع الذراع وثني المرفق خلف الرأس، ادفع بخفة بالإيد التانية.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/174/overhead-triceps-stretch/", neglected:"الراس الطويلة للترايسبس، محتاجة وضع فوق الرأس عشان تتمد بالكامل."},
    {en:"Lat Stretch", ar:"شد اللاتس", dur:"30 ث لكل جانب", note:"امسك حاجة ثابتة فوقك واسند بوزن جسمك للخلف والجانب.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/198/90-lat-stretch/", neglected:"اللاتس، بيتهمل مع التركيز على تمارين الصدر والكتف."}
  ],
  lower:[
    {en:"Standing Quad Stretch", ar:"شد الكوادز واقف", dur:"30 ث لكل رجل", note:"امسك كاحلك وادفع الكعب لمؤخرتك، الركبتين قريبين من بعض.", illustration:"https://pliability.com/stories/standing-quad-stretch", neglected:"الفخذ الأمامي، بيقصر مع كتر تمارين دفع الرجل من غير إطالة مقابلة."},
    {en:"Seated Hamstring Stretch", ar:"شد الهامسترينج قاعد", dur:"30 ث لكل رجل", note:"رجل مفرودة قدامك، ميل جذعك لقدام من الورك بضهر مستقيم.", illustration:"https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848", neglected:"الهامسترينج، بيتشد قليل عند اللي بيركزوا على الكوادز بس."},
    {en:"Figure-4 Glute Stretch", ar:"شد الجلوت (فيجر 4)", dur:"30 ث لكل جانب", note:"استلقي وحط كاحلك فوق الركبة التانية، اسحب الرجل السفلية لصدرك.", illustration:"https://www.rehabhero.ca/exercise/figure-4-stretch", neglected:"الجلوت والـ Piriformis، بيتهمل قدام إطالة أسفل الظهر."},
    {en:"Kneeling Hip Flexor Stretch", ar:"شد مثني الورك جاثي", dur:"30 ث لكل رجل", note:"ركبة واحدة بالأرض، ادفع الحوض لقدام بخفة من غير تقويس الظهر.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/142/kneeling-hip-flexor-stretch/", neglected:"Hip Flexors، بتقصر بسبب الجلوس الطويل وبتسبب APT."}
  ]
},

/* ---------------- APT EDUCATION (static text cards) --------------------- */
aptEducation:[
  {title:`${icon("help-circle")} إيه هو Anterior Pelvic Tilt؟`, body:"وضعية بيميل فيها الحوض للأمام لأسفل، بحيث يبان البطن مندفع لقدام والردف بارز أكتر من الطبيعي، ويزيد تقوس أسفل الظهر (Lumbar Lordosis)."},
  {title:`${icon("target")} الأسباب الشائعة`, body:"قعدة طويلة (مكتب/مذاكرة)، ضعف عام في عضلات البطن والجلوت، عدم توازن في تمارين الرجل (تركيز على الكوادز بس)، وأحيانًا عوامل وراثية في شكل الحوض."},
  {title:`${icon("lock")} العضلات المشدودة (Tight)`, body:"Hip Flexors (خصوصًا Iliopsoas)، أسفل الظهر (Erector Spinae)، وأحيانًا الكوادز الرباعية العلوية."},
  {title:`${icon("moon")} العضلات الضعيفة (Weak)`, body:"عضلات البطن (خصوصًا Lower Abs)، الجلوت (Glute Max خصوصًا)، والـ Hamstrings."},
  {title:`${icon("alert-triangle")} عادات يومية بتزود المشكلة`, body:"الجلوس أكتر من ساعة متواصلة، لبس أحذية بكعب مرتفع بشكل مستمر، النوم على البطن، وتمارين رجل تركز على الكوادز من غير Hamstrings/Glutes."},
  {title:`${icon("person-standing")} وضعية الوقوف الصحيحة`, body:"الأذن، الكتف، الورك، والكاحل على خط واحد تقريبًا. شد البطن بخفة (Brace) واعصر الجلوت شوية من غير مبالغة."},
  {title:`${icon("chair")} وضعية الجلوس الصحيحة`, body:"القدمين على الأرض، الركب بزاوية 90°، أسفل الظهر مسنود، وقوم كل 30-45 دقيقة تتحرك ولو دقيقة."},
  {title:`${icon("footprints")} وضعية المشي الصحيحة`, body:"خطوة طبيعية مش طويلة أوي، الحوض ثابت (مايتمايلش يمين شمال كتير)، وشد بسيط في البطن أثناء المشي."},
  {title:`${icon("moon")} توصيات النوم`, body:"النوم على الضهر أو الجنب أفضل من النوم على البطن. لو بتنام على الضهر، حط وسادة تحت الركب — بتقلل شد أسفل الظهر."}
],

/* ---------------- APT CORRECTIVE EXERCISE LIBRARY ------------------------ */
aptLibrary:[
  Ex({en:"Hip Flexor Stretch", ar:"شد مثني الورك", primary:"Hip Flexors (Iliopsoas)", classify:"Tight — بيتشد", purpose:"تطويل العضلة القصيرة اللي بتسحب الحوض لقدام.", sets:"2×30-45 ث لكل رجل", cue:"اعصر الجلوت الخلفي وادفع الحوض لقدام لحد الشد، الجذع مستقيم.", mistake:"تقويس أسفل الظهر بدل شد الورك فعليًا.", prog:"ارفع الإيد فوق نفس جهة الرجل الخلفية لزيادة الشد.", reg:"نفس الحركة واقف مسند على حيطة.", difficulty:"Beginner"}),
  Ex({en:"Couch Stretch", ar:"شد الكاوتش", primary:"Quads + Hip Flexors", classify:"Tight — بيتشد", purpose:"شد أعمق لمثنيات الورك والفخذ الأمامي.", sets:"1×30-45 ث لكل رجل", cue:"رجلك الخلفية مسندة على حيطة/كنبة، الحوض تحت العصر مش مايل.", mistake:"فتح الحوض للجانب بدل الاستواء لقدام.", prog:"ارفع الجذع مستقيم تمامًا بدل الميل لقدام.", reg:"ابدأ بمسافة أقرب من الحيطة.", difficulty:"Intermediate"}),
  Ex({en:"Standing Hip Flexor Stretch", ar:"شد الورك واقف", primary:"Hip Flexors", classify:"Tight — بيتشد", purpose:"نسخة سريعة تتعمل في أي مكان حتى في الشغل.", sets:"2×20-30 ث لكل رجل", cue:"لانج واقف، اعصر الجلوت وادفع الحوض لقدام بخفة.", mistake:"عدم عصر الجلوت خلال الحركة.", prog:"زود عمق اللانج.", reg:"استخدم كرسي أو حيطة للتوازن.", difficulty:"Beginner"}),
  Ex({en:"Glute Bridge", ar:"جسر الجلوت", primary:"Glute Max", classify:"Weak — بتتقوى", purpose:"تقوية الجلوت اللي بيسحب الحوض لوضعه الطبيعي.", sets:"3×12-15", cue:"اعصر الجلوت فوق بقوة، متخليش الضهر يقوس.", mistake:"الدفع بأسفل الظهر بدل الجلوت.", prog:"Single-leg Glute Bridge أو زود وزن على الحوض.", reg:"قلل المدى لحد ما تتحكم.", difficulty:"Beginner", illustration:"https://musclewiki.com/exercise/glute-bridge", neglected:"الجلوت، بيتهمل لصالح أسفل الظهر في تمارين الرفع."}),
  Ex({en:"Single-leg Glute Bridge", ar:"جسر الجلوت رجل واحدة", primary:"Glute Max (أحادي)", classify:"Weak — بتتقوى", purpose:"يكشف ويصحح الفرق بين الرجلين في قوة الجلوت.", sets:"2×10 لكل رجل", cue:"الحوض ثابت مايميلش لجنب وإنت رافع.", mistake:"لف الحوض للتعويض.", prog:"زود المدى أو أضف وزن.", reg:"ارجع للجسر العادي بالرجلين.", difficulty:"Intermediate"}),
  Ex({en:"Dead Bug", ar:"تنشيط الكور", primary:"Deep Core / Transverse Abdominis", classify:"Weak — بتتقوى", purpose:"يعلم الحوض يثبت في وضع محايد تحت حمل.", sets:"3×10 لكل جانب", cue:"ضهرك ملزق بالأرض طول الوقت، تنفس طبيعي.", mistake:"رفع أسفل الظهر عن الأرض.", prog:"مد الذراع والرجل المعاكسة بالكامل مع بعض.", reg:"حرك رجل واحدة بس في كل مرة.", difficulty:"Beginner", illustration:"https://musclewiki.com/exercise/dead-bug", neglected:"عمق البطن (Transverse Abdominis)، بيتهمل لصالح تمارين الكرنش السطحية."}),
  Ex({en:"Bird Dog", ar:"بيرد دوج", primary:"Core / Erector Spinae (ثبات)", classify:"Weak — بتتقوى", purpose:"ثبات الحوض والجذع أثناء حركة الأطراف.", sets:"3×10 لكل جانب", cue:"حافظ على استواء الحوض، الحركة بطيئة.", mistake:"لف الحوض أو رفع الرأس لفوق.", prog:"وقفة أطول (Hold) في أعلى نقطة.", reg:"حرك ذراع بس أو رجل بس.", difficulty:"Beginner", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/", neglected:"ثبات الجذع المضاد للدوران، بيتهمل قدام تمارين البطن العادية."}),
  Ex({en:"Side Plank", ar:"بلانك جانبي", primary:"Obliques / Glute Medius", classify:"Weak — بتتقوى", purpose:"ثبات جانبي للحوض، بيقلل الميل الجانبي أثناء المشي.", sets:"2×20-30 ث لكل جانب", cue:"جسمك خط مستقيم من الكتف للكاحل.", mistake:"سقوط الحوض لتحت.", prog:"ارفع الرجل العلوية أثناء الثبات.", reg:"اثبت على الركبة بدل القدم.", difficulty:"Intermediate"}),
  Ex({en:"Pallof Press", ar:"بالوف برس", primary:"Core (مضاد للدوران)", classify:"Weak — بتتقوى", purpose:"يبني ثبات الجذع اللي بيحمي أسفل الظهر يوميًا.", sets:"2×10 لكل جانب", cue:"ادفع لقدام ببطء وقاوم ميل جسمك للجنب.", mistake:"لف الجذع مع الدفع.", prog:"زود مقاومة الحزام/الكيبل.", reg:"قرب من نقطة التثبيت لتقليل المقاومة.", difficulty:"Intermediate"}),
  Ex({en:"Hip Airplane", ar:"طيارة الورك", primary:"Glutes + توازن", classify:"Weak — بتتقوى", purpose:"تحكم وقوة في الورك بحركة أحادية قريبة من الحياة اليومية.", sets:"2×6 لكل جانب", cue:"حركة بطيئة، استخدم حيطة للتوازن الأول.", mistake:"السرعة الزيادة اللي بتفقدك التحكم.", prog:"من غير مساعدة الحيطة.", reg:"مدى حركة أقل.", difficulty:"Advanced", illustration:"https://spotebi.com/exercise-guide/hip-circles/", neglected:"توازن وتحكم الورك أحادي الرجل، أهم عامل مهمل في إصابات الركبة."}),
  Ex({en:"Wall March", ar:"مارش الحيطة", primary:"Deep Core + Hip Flexors (تحكم)", classify:"Weak — بتتقوى", purpose:"يعلم رفع الركبة من غير ما الحوض يتحرك — تحكم أساسي.", sets:"2×10 لكل رجل", cue:"ضهرك وأدنيك ملزقين الحيطة، الحوض ثابت تمامًا.", mistake:"ميل الحوض مع رفع الركبة.", prog:"زود مدة الوقفة أعلى نقطة.", reg:"ارفع الركبة لمدى أقل.", difficulty:"Beginner"}),
  Ex({en:"Posterior Pelvic Tilt Drill", ar:"تمرين إمالة الحوض للخلف", primary:"Abs السفلية + Glutes", classify:"Weak — بتتقوى (تعليم حركة)", purpose:"يعلم جسمك إحساس الحوض المحايد بشكل مباشر.", sets:"2×10 عدات ببطء", cue:"وإنت مستلقي، اسطح أسفل الظهر بالأرض بشد البطن والجلوت.", mistake:"استخدام الرجلين للدفع بدل عضلات البطن.", prog:"اتمرن عليه واقف قدام مراية.", reg:"ابدأ مستلقي بس زي الوصف.", difficulty:"Beginner"}),
  Ex({en:"Cat Camel", ar:"قطة وجمل", primary:"العمود الفقري / الحوض", classify:"Mobility — تسخين", purpose:"يفك حركة الحوض والعمود الفقري قبل أي شغل تاني.", sets:"1×10 عدات ببطء", cue:"حرك الحوض مع نفسك بانسيابية.", mistake:"حركة سريعة من غير تحكم.", prog:"—", reg:"مدى أصغر.", difficulty:"Beginner", illustration:"https://www.rehabhero.ca/exercise/cat-camel", neglected:"عضلات العمود الفقري العميقة (Multifidus) اللي بتتهمل بسبب الجلوس الطويل."}),
  Ex({en:"90/90 Mobility", ar:"موبيليتي 90/90", primary:"مفصل الورك (دوران)", classify:"Mobility — تسخين", purpose:"يحسن مدى دوران الورك اللي بيتأثر بالجلوس الطويل.", sets:"2×8 لكل جانب", cue:"جذعك مستقيم، الحركة من الورك بس.", mistake:"استخدام الجذع للف بدل الورك.", prog:"انتقل من وضع لوضع من غير ما تستخدم إيدك.", reg:"استخدم إيدك تساعدك في التنقل.", difficulty:"Intermediate"})
],

/* ---------------- ROUNDED SHOULDERS EDUCATION (static text cards) ------- */
roundedShouldersEducation:[
  {title:`${icon("help-circle")} إيه هو Rounded Shoulders؟`, body:"الكتفين بيميلوا لقدام وللداخل عن وضعهم الطبيعي، فيبان الظهر العلوي محدودب شوية والصدر منقفل — غالبًا بييجي مع Forward Head (الرأس لقدام)."},
  {title:`${icon("target")} الأسباب الشائعة`, body:"قعدة طويلة قدام الكمبيوتر أو الموبايل، نسبة تمارين دفع (صدر/كتف) أكتر بكتير من تمارين سحب (ظهر) في برنامج التدريب، وضعف عام في عضلات أعلى الظهر."},
  {title:`${icon("lock")} العضلات المشدودة (Tight)`, body:"Pec Major/Minor (الصدر)، الكتف الأمامي (Anterior Delt)، وأحيانًا Lats والترابيز العلوي."},
  {title:`${icon("moon")} العضلات الضعيفة (Weak)`, body:"الترابيز الأوسط/السفلي، Rhomboids (بين لوحي الكتف)، Rear Delts (الكتف الخلفي)، وSerratus Anterior (تحت لوح الكتف)."},
  {title:`${icon("alert-triangle")} عادات يومية بتزود المشكلة`, body:"الانحناء على الموبايل لساعات (Tech Neck)، حمل شنطة على كتف واحد باستمرار، والنوم على البطن أو على الجنب بلف كامل للجسم."},
  {title:`${icon("dumbbell")} نسبة السحب:الدفع في التمرين`, body:"لو بتعمل تمارين دفع (بنش/كتف) بنفس حجم تمارين السحب (ظهر) بالظبط أو أكتر، الكتف هيميل لقدام مع الوقت. النسبة المثالية للتصحيح تقريبًا سحب ضعف الدفع (2:1)."},
  {title:`${icon("person-standing")} وضعية الوقوف الصحيحة`, body:"الأذن، الكتف، الورك، والكاحل على خط واحد تقريبًا. لوحي الكتف لتحت وللخلف بخفة (مش تكشيرة مبالغ فيها)، الصدر واطي وطبيعي."},
  {title:`${icon("chair")} وضعية الشاشة والمكتب`, body:"شاشة الموبايل/اللابتوب في مستوى العين مش تحت — عشان متطأطئش رقبتك. المرفقين بزاوية 90° وأنت قاعد، والكتفين مرخيين مش مرفوعين."},
  {title:`${icon("moon")} توصيات النوم`, body:"النوم على الضهر أفضل خيار. لو بتنام على الجنب، حاول متلفش جسمك بالكامل للأمام حوالين الوسادة لساعات طويلة."}
],

/* ---------------- ROUNDED SHOULDERS CORRECTIVE EXERCISE LIBRARY --------- */
roundedShouldersLibrary:[
  Ex({en:"Doorway Pec Stretch", ar:"شد الصدر بالباب", primary:"Pec Major", classify:"Tight — بيتشد", purpose:"تطويل عضلة الصدر اللي بتسحب الكتف لقدام.", sets:"3×30 ث لكل جانب", cue:"ساعدك على إطار الباب بزاوية 90°، ميل جسمك لقدام بخفة.", mistake:"رفع الكتف لفوق أثناء الشد بدل ترخيته.", prog:"جرب زوايا مختلفة للساعد (أعلى/أوطى) تستهدف أجزاء مختلفة من الصدر.", reg:"شد أخف بميل أقل.", difficulty:"Beginner"}),
  Ex({en:"Pec Minor Release (Foam Roller)", ar:"فرد الصدر الصغير بالفوم رولر", primary:"Pec Minor", classify:"Tight — بيتشد", purpose:"شد أعمق للعضلة اللي بتسحب لوح الكتف لقدام وتحت مباشرة.", sets:"1×60-90 ث لكل جانب", cue:"استلقي على جنبك مع الفوم رولر تحت الصدر مباشرة، تنفس ببطء.", mistake:"ضغط زيادة على المفصل بدل العضلة.", prog:"—", reg:"استخدم كرة تنس بدل الفوم رولر لضغط أخف.", difficulty:"Beginner"}),
  Ex({en:"Chin Tuck", ar:"سحب الذقن للخلف", primary:"عضلات الرقبة العميقة", classify:"Weak — بتتقوى", purpose:"يصحح Forward Head المصاحب غالبًا لـ Rounded Shoulders.", sets:"2×10 عدات، وقفة 3 ث", cue:"اسحب ذقنك للخلف زي ما بتعمل 'ذقن مزدوج'، من غير ما تطأطئ رأسك.", mistake:"طأطأة الرأس لتحت بدل السحب المستقيم للخلف.", prog:"اعمله واقف مسند على حيطة.", reg:"مدى حركة أصغر.", difficulty:"Beginner"}),
  Ex({en:"Prone Y-Raise", ar:"رفعة Y مستلقي", primary:"الترابيز السفلي", classify:"Weak — بتتقوى", purpose:"تقوية أضعف جزء في الترابيز، المسؤول عن دوران لوح الكتف لفوق.", sets:"2×12-15", cue:"مستلقي على بطنك، ارفع ذراعيك بشكل حرف Y مع عصر لوحي الكتف لتحت.", mistake:"رفع الذراع من غير عصر لوح الكتف — بيحول الشغل للكتف بس.", prog:"أضف وزن خفيف جدًا (0.5-1 كجم) في كل إيد.", reg:"اعمله بدون وزن، تركيز على الحركة بس.", difficulty:"Beginner"}),
  Ex({en:"Prone T-Raise", ar:"رفعة T مستلقي", primary:"الترابيز الأوسط / Rhomboids", classify:"Weak — بتتقوى", purpose:"تقوية العضلات بين لوحي الكتف مباشرة.", sets:"2×12-15", cue:"مستلقي على بطنك، افرد ذراعيك على الجانب بشكل حرف T واعصر لوحي الكتف من بعض.", mistake:"استخدام هز الجسم بدل عضلات الظهر.", prog:"أضف وزن خفيف.", reg:"مدى حركة أصغر.", difficulty:"Beginner"}),
  Ex({en:"Wall Slides", ar:"انزلاق الحيطة", primary:"الكتف / الترابيز السفلي", classify:"Mobility — تسخين وتحكم", purpose:"يعلم الكتف يتحرك فوق الرأس صح من غير ما يميل لقدام.", sets:"2×10", cue:"ضهرك وإيديك ملزقين الحيطة طول الحركة وإنت بتزحلق لفوق.", mistake:"فقدان اتصال الظهر أو الإيد بالحيطة أثناء الرفع.", prog:"زود عدد المرات أو ابطئ الحركة.", reg:"مدى حركة أقل (متطلعش لفوق أوي).", difficulty:"Beginner", illustration:"https://www.muscleandstrength.com/exercises/scapular-wall-slide", neglected:"الترابيز السفلي والتحكم في دوران لوح الكتف فوق الرأس."}),
  Ex({en:"Band External Rotation", ar:"دوران خارجي بالحزام", primary:"Rotator Cuff (Infraspinatus)", classify:"Weak — بتتقوى", purpose:"يقوي العضلات المسؤولة عن دوران الكتف للخارج، غالبًا ضعيفة جدًا في Rounded Shoulders.", sets:"2×15 لكل جانب", cue:"المرفق ثابت جنب جسمك بزاوية 90°، دور الساعد للخارج بس.", mistake:"تحريك المرفق بعيد عن الجسم بدل تثبيته.", prog:"زود مقاومة الحزام.", reg:"مدى حركة أصغر.", difficulty:"Beginner", illustration:"https://www.muscleandstrength.com/exercises/single-arm-banded-external-rotation", neglected:"الدوارة الكتفية الخارجية (Infraspinatus/Teres Minor)، أضعف عضلة عند غالبية الناس."}),
  Ex({en:"Scapular Retraction Hold", ar:"وقفة عصر لوح الكتف", primary:"Rhomboids / الترابيز الأوسط", classify:"Weak — بتتقوى", purpose:"يبني إحساس ووعي بوضعية الكتف الصح قبل ما تتحول لعادة.", sets:"3×15-20 ث وقفة", cue:"اعصر لوحي الكتف من بعض واثبت، الكتفين لتحت مش لفوق.", mistake:"رفع الكتفين لفوق أثناء العصر (بيشغل الترابيز العلوي الغلط).", prog:"اعمله مع مقاومة خفيفة (حزام).", reg:"وقفة أقصر.", difficulty:"Beginner"}),
  Ex({en:"Thoracic Extension (Foam Roller)", ar:"فرد أعلى الظهر بالفوم رولر", primary:"العمود الفقري العلوي", classify:"Mobility — تسخين", purpose:"يفك تحدّب أعلى الظهر (Kyphosis) اللي بيصاحب انحناء الكتف غالبًا.", sets:"1×8-10 حركات ببطء", cue:"الفوم رولر أفقي تحت لوحي الكتف، مد ضهرك فوقه ببطء وإيديك خلف رأسك.", mistake:"مد أسفل الظهر بدل أعلاه (خطر على أسفل الظهر).", prog:"زود مدى الحركة تدريجيًا.", reg:"حركة أصغر وأبطأ.", difficulty:"Beginner", illustration:"https://www.healthline.com/health/roller-foam-for-back", neglected:"تحدّب أعلى الظهر (Kyphosis)، بيتهمل غالبًا لصالح إطالة أسفل الظهر بس."})
],

/* ---------------- MAIN WORKOUT DAYS --------------------------------------
 * Each `main` entry is a DayEx() reference — an `id` into the shared
 * Exercise Library (exercises-data.js EXERCISES) plus this program's own
 * prescription for that exercise. Name, muscle group, equipment,
 * difficulty, and illustration are resolved from the library at render
 * time (workout.js `resolveDayExercise`) — never duplicated here. See
 * DayEx() above for field docs.
 * -------------------------------------------------------------------- */
/* ---------------- v2.0 PROGRAM NOTE (تضخيم + APT + Rounded Shoulders) --
 * Redesigned from a 3-day "body-part split" (Upper / Lower / Arms) to a
 * Full Body A/B/C split, still exactly 3 sessions/week. Reasoning:
 *  - With only 3 lifting days/week and limited food intake (Amir's own
 *    constraint — no room for a 4th/5th day without adequate fuel to
 *    recover it), a body-part split hits each muscle only ONCE a week.
 *    Meta-analyses on training frequency (e.g. Schoenfeld/Grgic 2016-18)
 *    show 2-3×/week per muscle beats 1×/week for hypertrophy at equal
 *    weekly volume — so Full Body gets more growth from the SAME 3 days.
 *  - Corrective work for APT and Rounded Shoulders responds better to
 *    frequent, submaximal practice than to one heavy day/week. Every
 *    Full Body session now opens with the same glute/dead-bug (APT) and
 *    face-pull/scap (shoulder) activation block — 3×/week instead of 1×.
 *  - Every day still includes 1 heavy hip-hinge or squat pattern
 *    (RDL/Hip Thrust/Squat), which is BOTH the main hypertrophy driver
 *    AND the direct fix for the two weak links in APT (glutes,
 *    hamstrings) — no wasted, purely-corrective volume competing with
 *    limited recovery capacity from low food intake.
 *  - Weekly pull : push ratio is roughly 2 : 1 (rows/pull-ups/face-pulls
 *    vs presses) — the standard recommendation for reversing Rounded
 *    Shoulders without ever dropping pressing volume to zero.
 *  - Total main-lift sets/session kept at 5-6 exercises (not 8+) on
 *    purpose: on a food-limited "controlled bulk" more junk volume just
 *    means more fatigue without more muscle — better to nail fewer,
 *    highly-effective compound lifts and progress their load/reps every
 *    week (double progression) than to chase more exercises.
 * ------------------------------------------------------------------- */
day1:{
  title:"اليوم الأول — Full Body A (Squat Focus)",
  warmupType:"full",
  main:[
    DayEx({id:"back-squat", stabilizers:"Core, أسفل الظهر",
      sets:"3×8-10", tempo:"2-0-1", rest:"120 ث", rpe:"RPE 8", cue:"الركبة والحوض ينزلوا مع بعض، شد البطن (Brace) قبل النزول، واعصر الجلوت فوق.",
      mistake:"تقويس أسفل الظهر تعويضًا عن ميل الحوض — أهم غلطة تتراقبها لو عندك APT.",
      why:"أقوى تمرين مركب لبناء حجم الرجل كله، وبيدرّب الجسم يثبت الحوض تحت حمل — مباشر لتصحيح APT مش بس لبناء العضل.",
      prog:"زود 2.5 كجم كل أسبوع-أسبوعين لو الفورم ثابت من غير ألم.", reg:"Leg Press أو Goblet Squat لو حسيت ضغط على أسفل الظهر."}),
    DayEx({id:"incline-db-press", stabilizers:"Core",
      sets:"3×10-12", tempo:"2-0-1", rest:"75 ث", rpe:"RPE 7-8", cue:"زاوية البنش 30° بالظبط، متزودش الزاوية أكتر عشان متحولش لتمرين كتف.",
      mistake:"زاوية بنش عالية أوي (45°+) بتقلل شغل الصدر وتزود شغل الكتف الأمامي (يخلي وضع الكتف أسوأ مش أحسن).",
      why:"الصدر العلوي من أضعف مناطق النمو عند غالبية الناس، والزاوية المنخفضة نسبيًا بتستهدفه بدقة.",
      prog:"زود الوزن أو جرب Incline Barbell Press.", reg:"Incline Push-up.",
      vid:"8iPvtZbeY08"}),
    DayEx({id:"chest-supported-row", stabilizers:"الظهر العلوي",
      sets:"3×10-12", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"صدرك مسنود بالكامل على الوسادة المائلة، اسحب لبطنك واعصر لوحي الكتف من بعض فوق.",
      mistake:"عدم عصر لوحي الكتف في نهاية الحركة — بيحول التمرين لشغل ذراع بس من غير فايدة للوضعية.",
      why:"بيبني سمك الظهر وقوة عضلات مضادة لانحناء الكتف للأمام، بدون أي حمل على أسفل الظهر (مناسب أكتر من الرو المنحني لو مركز تركز على APT).",
      prog:"زود الوزن أو جرب Pendlay Row.", reg:"Seated Cable Row بمقعد مسنود."}),
    DayEx({id:"face-pull", stabilizers:"Core",
      sets:"3×15", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 7", cue:"افتح صدرك واسحب الحبل لوشك مع فتح المرفقين لبره.",
      mistake:"سحب لأسفل الصدر بدل لوشك بيقلل شغل الـ Rear Delts والوضعية المطلوبة.",
      why:"أهم تمرين تصحيحي لـ Rounded Shoulders — بيتكرر 3 مرات في الأسبوع (مش مرة واحدة) عشان التصحيح يحتاج تكرار عالي.",
      prog:"زود المقاومة أو العدات لـ 20.", reg:"Band Face Pull بمقاومة أخف.",
      vid:"rep-qVOkqgk"}),
    DayEx({id:"hanging-leg-raise", stabilizers:"Grip, أسفل الظهر",
      sets:"3×10-12", tempo:"2-0-2", rest:"60 ث", rpe:"RPE 7", cue:"ارفع رجليك بميل الحوض للخلف (Posterior Tilt) مش بس ثني الورك.",
      mistake:"هز الجسم (Swinging) بيحول التمرين لحركة مفاصل بدون شغل بطن حقيقي.",
      why:"تمرين بطن Anti-Extension بيعلم الحوض يعمل الحركة المعاكسة لـ APT بالظبط تحت تحكم.",
      prog:"زود العدد أو أضف وزن بين القدمين.", reg:"Reverse Crunch أو Cable Crunch (نيلينج) لو الجري صعب."})
  ]
},

day2:{
  title:"اليوم الثاني — Full Body B (Hinge Focus)",
  warmupType:"full",
  main:[
    DayEx({id:"rdl", stabilizers:"Core, Grip",
      sets:"3×8-10", tempo:"3-0-1", rest:"90 ث", rpe:"RPE 8", cue:"الحوض للخلف مش الركبة، الضهر مستقيم طول الوقت والوزن قريب من الرجل.",
      mistake:"تقويس أو تقعير أسفل الظهر أثناء النزول.",
      why:"أفضل تمرين لتقوية الـ Hamstrings والجلوت مع بعض — العضلتين الضعيفتين الرئيسيتين في APT — وبيبني حجم خلف الرجل بالكامل.",
      prog:"زود الوزن تدريجيًا 2.5-5 كجم.", reg:"استخدم دمبلز أخف أو قلل مدى الحركة لحد ما تتحكم في الفورم.",
      vid:"JCXUYuzwvgQ"}),
    DayEx({id:"pullups", stabilizers:"Core, Forearms",
      sets:"3×8-10", tempo:"1-0-2", rest:"90 ث", rpe:"RPE 8", cue:"اسحب بالكوع مش بالإيد، ونزول كامل تحت.",
      mistake:"نزول جزئي (مش مادّ الذراع بالكامل تحت) بيقلل مدى الحركة والفايدة.",
      why:"أفضل تمرين لعرض الظهر (V Taper) — تمرين مركب بيشغل الظهر كله مع تحفيز جيد للنمو وسحب مضاد لانحناء الكتف.",
      prog:"أضف وزن (Weighted Pull-up).", reg:"Assisted Pull-up أو Lat Pulldown.",
      vid:"eGo4IYlbE5g"}),
    DayEx({id:"seated-db-press", stabilizers:"Core",
      sets:"3×8-10", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"شد الكور قبل ما تدفع فوق، الدمبلز فوق خط الكتف مش قدامه.",
      mistake:"تقويس أسفل الظهر للمساعدة في الدفع.",
      why:"بيبني حجم وقوة الكتف بشكل شامل — أساسي لعرض الجزء العلوي والتحكم في الكتف فوق الرأس.",
      prog:"زود الوزن أو جرب Barbell Overhead Press واقف.", reg:"استخدم مقعد بظهر مائل لمساندة أكتر."}),
    DayEx({id:"bulgarian-split-squat", stabilizers:"Core, توازن",
      sets:"3×8 لكل رجل", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"حافظ على ثبات الجسم، الركبة متتعديش الإصبع.",
      mistake:"ميل الجذع لقدام بشكل زيادة بيحول الشغل للجلوت بس ويفقد توازن الحركة.",
      why:"تمرين أحادي بيكشف ويصحح فروق القوة بين الرجلين، وبيشغل الكوادز بكثافة عالية من غير حمل تقيل زيادة على أسفل الظهر.",
      prog:"زود وزن الدمبلز.", reg:"Split Squat عادي من غير ارتفاع الرجل الخلفية.",
      vid:"2C-uNgKwPLE"}),
    DayEx({id:"reverse-pec-deck", stabilizers:"الظهر العلوي",
      sets:"3×15", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 7", cue:"مرفق مرفوع شوية، افتح للخارج واعصر لوحي الكتف من بعض.",
      mistake:"استخدام وزن تقيل بيخلي الحركة تعتمد على هز الجسم بدل الكتف الخلفي.",
      why:"تحفيز مباشر ومعزول للـ Rear Delts — العضلة اللي بتشد الكتف لورا وبتقاوم الانحناء للأمام.",
      prog:"زود الوزن تدريجيًا.", reg:"Band Pull Apart بمقاومة أخف."}),
    DayEx({id:"pallof-press", stabilizers:"Core",
      sets:"2×10 لكل جانب", tempo:"بطيء ومتحكم", rest:"45 ث", rpe:"RPE 6", cue:"ادفع لقدام ببطء وقاوم ميل جسمك للجنب، الحوض والجذع ثابتين.",
      mistake:"لف الجذع مع الدفع بدل مقاومة اللف.",
      why:"يقفل اليوم بثبات جذع مضاد للدوران — يحمي أسفل الظهر بعد يوم فيه هينج تقيل ويدعم وضعية الحوض المحايدة.",
      prog:"زود مقاومة الحزام/الكيبل.", reg:"قرب من نقطة التثبيت لتقليل المقاومة."})
  ]
},

day3:{
  title:"اليوم الثالث — Full Body C (Hip Thrust + Arms)",
  warmupType:"full",
  main:[
    DayEx({id:"hip-thrust", stabilizers:"Core",
      sets:"3×10-12", tempo:"2-1-1", rest:"90 ث", rpe:"RPE 8", cue:"اعصر الجلوت فوق لثانيتين، الذقن لتحت شوية، متقوسش أسفل الظهر عند القمة.",
      mistake:"الدفع بأسفل الظهر بدل الجلوت — لو حسيت شد في الضهر يبقى الفورم أو الوزن غلط.",
      why:"أعلى تفعيل EMG موثق لعضلة الجلوت الأساسية — أقوى تمرين تصحيحي وتضخيمي مع بعض لأضعف عضلة في حالة APT.",
      prog:"زود الوزن تدريجيًا 2.5-5 كجم.", reg:"Glute Bridge بوزن الجسم لحد ما تتحكم في الفورم."}),
    DayEx({id:"flat-db-press", stabilizers:"Core, الكتف",
      sets:"3×8-10", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"الدمبلز تنزل لحد ما تحس شد خفيف في الصدر، مش أعمق من كده لو حاسس ألم كتف.",
      mistake:"نزول عميق أوي بيحمّل مفصل الكتف بشكل غير آمن، خصوصًا مع وضعية كتف مش مثالية.",
      why:"تمرين مركب أساسي لحجم الصدر الكلي وقوة الدفع — مدى الحركة بالدمبلز أوسع وأأمن على الكتف من البار.",
      prog:"زود الوزن أو جرب Flat Barbell Bench.", reg:"Push-up أو Machine Chest Press."}),
    DayEx({id:"seated-cable-row", stabilizers:"أسفل الظهر, Core",
      sets:"3×10-12", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"اسحب لبطنك واعصر لوحي الكتف من بعض، متلفش بجسمك للخلف بشكل مبالغ فيه.",
      mistake:"استخدام هز الجسم (Momentum) للسحب بدل عضلات الظهر.",
      why:"بيبني سمك الظهر ويوازن كل شغل الدفع في اليوم — أساسي في نسبة السحب:الدفع (2:1) المطلوبة لتصحيح الكتف.",
      prog:"زود الوزن أو جرب T-Bar Row.", reg:"مدى حركة أقصر مع وزن أخف."}),
    DayEx({id:"lateral-raise", stabilizers:"Core",
      sets:"3×15", tempo:"2-0-2", rest:"60 ث", rpe:"RPE 8", cue:"ارفع للخارج مش لقدام، ومرفق مرفوع شوية عن اليد.",
      mistake:"استخدام وزن تقيل بيخلي الحركة تعتمد على الترابيز بدل الكتف الجانبي.",
      why:"العضلة الوحيدة المسؤولة عن عرض الكتف من الجنب — أساسية لشكل V Taper.",
      prog:"زود العدات لـ 20 قبل ما تزود الوزن.", reg:"Cable Lateral Raise بمقاومة أخف وأثبت.",
      vid:"3VcKaXpzqRo"}),
    DayEx({id:"cable-curl", stabilizers:"Core",
      sets:"2×10-12", tempo:"2-0-2", rest:"45 ث (سوبرسيت مع اللي بعده)", rpe:"RPE 8", cue:"تحكم في النزول، متسيبش الوزن يسقط، اعمله سوبرسيت مباشرة مع Tricep Pushdown.",
      mistake:"هز الجسم للمساعدة في رفع الوزن (Cheat Curl) بيقلل الفايدة.",
      why:"شغل مباشر للباي — سوبرسيت مع التراي عشان تحافظ على وقت الجلسة قصير مع نفس التحفيز.",
      prog:"زود الوزن تدريجيًا.", reg:"استخدم حزام مطاطي بدل الكيبل.",
      vid:"TwD-YGVP4Bk"}),
    DayEx({id:"tricep-pushdown", stabilizers:"Core",
      sets:"2×12-15", tempo:"2-0-1", rest:"60 ث", rpe:"RPE 8", cue:"ثبت الكوع جنبك، متفتحوش لبره أثناء الدفع.",
      mistake:"فتح المرفق للخارج بيقلل تفعيل الترايسبس ويحمّل الكتف.",
      why:"حركة عزل آمنة وفعالة لإنهاء تمارين اليوم بأقل إجهاد على المفاصل — سوبرسيت مع الكيرل قبله.",
      prog:"زود الوزن أو جرب Overhead Tricep Extension لتحفيز إضافي.", reg:"استخدم حزام مطاطي بدل الكيبل.",
      vid:"2-LAMcpzHLU"})
  ]
},

/* ---------------- PPL (Push / Pull / Legs) DAYS — Phase 2 -----------------
 * Added on top of the original Full Body A/B/C days (day1..day3, which are
 * untouched so their saved sets/logs/history keep working).
 *
 * Day keys are camelCase on purpose (dayPushA, not day-push-a): workout
 * state keys are built as "<dayKey>-main-<index>" and parsed with
 * key.split("-"), so a day key must never contain a hyphen. They also
 * start with "day" because workout.js hydration looks for sec-day*.
 *
 * A / B variants: the 6-day plan runs each pattern twice a week. A is the
 * heavy/compound-led session, B changes the main lift and emphasis so the
 * same muscle is not trained identically twice. The 3-day PPL plan uses
 * the A sessions only.
 *
 * Shoulder-health note (kept from the Full Body program): every Push day
 * is paired with Pull volume; Pull days carry face-pull/rear-delt work, and
 * the pull:push set ratio across the 6-day week stays >= 1.
 * ------------------------------------------------------------------- */
dayPushA:{
  title:"يوم الدفع — Push A (Chest Focus)", split:"push", warmupType:"upper",
  main:[
    DayEx({id:"flat-barbell-bench", stabilizers:"Core, الكتف",
      sets:"4×6-8", tempo:"2-0-1", rest:"120 ث", rpe:"RPE 8", cue:"لوحي الكتف مشدودين لورا وتحت، القدمين ثابتين، انزل للصدر بتحكم وادفع في خط مائل خفيف.",
      mistake:"رفع الكتفين لفوق أو تقويس أسفل الظهر زيادة — بيحمّل الكتف ويقلل شغل الصدر.",
      why:"أقوى تمرين مركب لحجم الصدر والتراي والكتف الأمامي، وأحسن تمرين تقيس بيه تطور قوة الدفع.",
      prog:"زود 2.5 كجم لما تكمل كل المجموعات على أعلى عدات.", reg:"Flat DB Press لو الكتف مش مرتاح مع البار."}),
    DayEx({id:"incline-db-press", stabilizers:"Core",
      sets:"3×8-12", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"زاوية البنش 30°، الدمبلز تنزل لحد شد خفيف في الصدر العلوي.",
      mistake:"زاوية عالية (45°+) بتحوله لتمرين كتف.",
      why:"الصدر العلوي من أضعف مناطق النمو عند غالبية الناس.",
      prog:"زود الوزن أو العدات.", reg:"Incline Push-up.",
      vid:"8iPvtZbeY08"}),
    DayEx({id:"seated-db-press", stabilizers:"Core",
      sets:"3×8-10", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"شد الكور قبل الدفع، الدمبلز فوق خط الكتف مش قدامه.",
      mistake:"تقويس أسفل الظهر للمساعدة في الدفع.",
      why:"بيبني حجم وقوة الكتف الأمامي والجانبي.",
      prog:"زود الوزن أو جرب Barbell Overhead Press.", reg:"استخدم مقعد بظهر مائل."}),
    DayEx({id:"lateral-raise", stabilizers:"Core",
      sets:"3×12-15", tempo:"2-0-2", rest:"60 ث", rpe:"RPE 8", cue:"ارفع للخارج مش لقدام، والمرفق أعلى من اليد شوية.",
      mistake:"وزن تقيل بيحول الشغل للترابيز.",
      why:"المسؤول عن عرض الكتف من الجنب.",
      prog:"زود العدات لـ 20 قبل ما تزود الوزن.", reg:"Cable Lateral Raise.",
      vid:"3VcKaXpzqRo"}),
    DayEx({id:"overhead-cable-triceps-extension", stabilizers:"Core",
      sets:"3×10-12", tempo:"2-0-1", rest:"60 ث", rpe:"RPE 8", cue:"المرفقين لفوق وقريبين من الراس، مد كامل في النهاية.",
      mistake:"فتح المرفقين للخارج.",
      why:"وضع فوق الرأس بيمط الراس الطويلة للتراي وده أكبر جزء في العضلة.",
      prog:"زود الوزن تدريجيًا.", reg:"Overhead DB Extension."}),
    DayEx({id:"tricep-pushdown", stabilizers:"Core",
      sets:"2×12-15", tempo:"2-0-1", rest:"60 ث", rpe:"RPE 8", cue:"ثبت الكوع جنبك طول الحركة.",
      mistake:"فتح المرفق للخارج.",
      why:"عزل آمن لإنهاء يوم الدفع بأقل إجهاد على المفاصل.",
      prog:"زود الوزن أو العدات.", reg:"حزام مطاطي بدل الكيبل.",
      vid:"2-LAMcpzHLU"})
  ]
},

dayPullA:{
  title:"يوم السحب — Pull A (Width + Thickness)", split:"pull", warmupType:"upper",
  main:[
    DayEx({id:"pullups", stabilizers:"Core, Forearms",
      sets:"4×6-10", tempo:"1-0-2", rest:"120 ث", rpe:"RPE 8", cue:"اسحب بالكوع مش بالإيد، ونزول كامل لتحت.",
      mistake:"نزول جزئي بيقلل المدى والفايدة.",
      why:"أفضل تمرين مركب لعرض الظهر وسحب مضاد لانحناء الكتف.",
      prog:"أضف وزن (Weighted Pull-up).", reg:"Lat Pulldown أو Assisted Pull-up.",
      vid:"eGo4IYlbE5g"}),
    DayEx({id:"chest-supported-row", stabilizers:"الظهر العلوي",
      sets:"3×8-12", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"الصدر مسنود، اسحب لبطنك واعصر لوحي الكتف فوق.",
      mistake:"عدم عصر لوحي الكتف في النهاية.",
      why:"بيبني سمك الظهر من غير حمل على أسفل الظهر.",
      prog:"زود الوزن أو جرب Pendlay Row.", reg:"Seated Cable Row."}),
    DayEx({id:"single-arm-db-row", stabilizers:"Core, Grip",
      sets:"3×10-12 لكل جانب", tempo:"2-0-1", rest:"75 ث", rpe:"RPE 8", cue:"اسحب الدمبل ناحية الحوض مش الكتف، والجذع ثابت.",
      mistake:"لف الجذع للمساعدة في الرفع.",
      why:"أحادي الجانب — بيصحح فرق القوة بين الجنبين ومدى حركة أكبر.",
      prog:"زود الوزن.", reg:"Seated Cable Row."}),
    DayEx({id:"face-pull", stabilizers:"Core",
      sets:"3×15", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 7", cue:"افتح صدرك واسحب الحبل لوشك مع فتح المرفقين.",
      mistake:"سحب لأسفل الصدر بدل لوشك.",
      why:"أهم تمرين تصحيحي لـ Rounded Shoulders.",
      prog:"زود المقاومة أو العدات لـ 20.", reg:"Band Face Pull.",
      vid:"rep-qVOkqgk"}),
    DayEx({id:"ez-bar-curl", stabilizers:"Core",
      sets:"3×8-12", tempo:"2-0-2", rest:"60 ث", rpe:"RPE 8", cue:"المرفقين ثابتين جنبك، انزل ببطء.",
      mistake:"هز الجسم للمساعدة (Cheat Curl).",
      why:"شغل مباشر للباي بعد تمارين السحب المركبة.",
      prog:"زود الوزن تدريجيًا.", reg:"Cable Curl أو Dumbbell Curl."}),
    DayEx({id:"hammer-curl", stabilizers:"Core, Grip",
      sets:"2×10-12", tempo:"2-0-2", rest:"60 ث", rpe:"RPE 8", cue:"قبضة محايدة، المرفق ثابت.",
      mistake:"تأرجح الكتف مع الرفع.",
      why:"بيشغل Brachialis والساعد — بيزود سمك الدراع.",
      prog:"زود الوزن أو العدات.", reg:"Cable Rope Curl."})
  ]
},

dayLegsA:{
  title:"يوم الرجل — Legs A (Squat Focus)", split:"legs", warmupType:"lower",
  main:[
    DayEx({id:"back-squat", stabilizers:"Core, أسفل الظهر",
      sets:"4×6-8", tempo:"2-0-1", rest:"150 ث", rpe:"RPE 8", cue:"شد البطن (Brace) قبل النزول، الركبة والحوض ينزلوا مع بعض، اعصر الجلوت فوق.",
      mistake:"تقويس أسفل الظهر تعويضًا عن ميل الحوض — راقبها لو عندك APT.",
      why:"أقوى تمرين مركب لحجم الرجل وبيدرّب الحوض يثبت تحت حمل.",
      prog:"زود 2.5 كجم كل أسبوع-أسبوعين لو الفورم ثابت.", reg:"Leg Press أو Goblet Squat."}),
    DayEx({id:"rdl", stabilizers:"Core, Grip",
      sets:"3×8-10", tempo:"3-0-1", rest:"120 ث", rpe:"RPE 8", cue:"الحوض للخلف مش الركبة، الضهر مستقيم والبار قريب من الرجل.",
      mistake:"تقويس أسفل الظهر أثناء النزول.",
      why:"أفضل تمرين للهامسترينج والجلوت مع بعض — العضلتين الضعيفتين في APT.",
      prog:"زود الوزن 2.5-5 كجم.", reg:"دمبلز أخف أو مدى حركة أقل.",
      vid:"JCXUYuzwvgQ"}),
    DayEx({id:"walking-lunge", stabilizers:"Core, توازن",
      sets:"3×10 لكل رجل", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"خطوة واسعة، الجذع مستقيم، انزل لحد ما الركبة الخلفية تلمس الأرض تقريبًا وادفع بالكعب.",
      mistake:"خطوة قصيرة بتحمّل الركبة بدل الجلوت، أو ميل الجذع لقدام.",
      why:"بيشغل الجلوت والكوادز بحركة أحادية — يضمن الجلوت يتدرب مرتين في الأسبوع (مع Hip Thrust في Legs B).",
      prog:"زود وزن الدمبلز.", reg:"Split Squat ثابت أو Leg Press."}),
    DayEx({id:"seated-leg-curl", stabilizers:"",
      sets:"3×10-12", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 8", cue:"اضغط بالكعب، وقفة ثانية في أقصى انقباض.",
      mistake:"رفع الحوض عن المقعد.",
      why:"عزل للهامسترينج في وضع الجلوس (مدى أطول للعضلة).",
      prog:"زود الوزن.", reg:"Lying Leg Curl."}),
    DayEx({id:"standing-calf-raise-machine", stabilizers:"",
      sets:"4×10-15", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 8", cue:"نزول كامل لتحت ووقفة ثانية، وارتفاع كامل على أطراف الأصابع.",
      mistake:"حركة قصيرة وسريعة.",
      why:"السمانة بتحتاج مدى كامل وحجم عالي.",
      prog:"زود العدات قبل الوزن.", reg:"Single-leg Calf Raise بوزن الجسم."}),
    DayEx({id:"hanging-leg-raise", stabilizers:"Grip, أسفل الظهر",
      sets:"3×10-12", tempo:"2-0-2", rest:"60 ث", rpe:"RPE 7", cue:"ارفع رجليك بإمالة الحوض للخلف (Posterior Tilt).",
      mistake:"هز الجسم (Swinging).",
      why:"بطن Anti-Extension بيعلم الحوض عكس APT تحت تحكم.",
      prog:"زود العدد أو أضف وزن.", reg:"Reverse Crunch."})
  ]
},

dayPushB:{
  title:"يوم الدفع — Push B (Shoulder Focus)", split:"push", warmupType:"upper",
  main:[
    DayEx({id:"barbell-overhead-press", stabilizers:"Core, الكتف",
      sets:"4×6-8", tempo:"2-0-1", rest:"120 ث", rpe:"RPE 8", cue:"اعصر الجلوت وشد البطن، ادفع البار في خط مستقيم وراس تمر للأمام في الأعلى.",
      mistake:"تقويس أسفل الظهر وميل الجذع للخلف.",
      why:"أقوى تمرين مركب لحجم وقوة الكتف.",
      prog:"زود 1-2.5 كجم.", reg:"Seated DB Press."}),
    DayEx({id:"machine-chest-press", stabilizers:"الكتف",
      sets:"3×8-12", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"ظهر ملزق بالمقعد، ادفع من الصدر مش الكتف.",
      mistake:"رفع الكتفين لفوق.",
      why:"حجم للصدر بثبات عالي وإجهاد أقل على الكتف بعد الضغط فوق الرأس.",
      prog:"زود الوزن.", reg:"Flat DB Press."}),
    DayEx({id:"cable-fly", stabilizers:"",
      sets:"3×12-15", tempo:"2-1-1", rest:"60 ث", rpe:"RPE 8", cue:"انحناء بسيط في المرفق ثابت، اعصر الصدر في النهاية.",
      mistake:"تحويل الحركة لضغط (ثني المرفق زيادة).",
      why:"عزل للصدر بشد مستمر على طول الحركة.",
      prog:"زود الوزن أو العدات.", reg:"Pec Deck Fly."}),
    DayEx({id:"cable-lateral-raise", stabilizers:"Core",
      sets:"4×12-15", tempo:"2-0-2", rest:"60 ث", rpe:"RPE 8", cue:"ارفع للجنب مع شد ثابت من الكيبل، متتأرجحش.",
      mistake:"استخدام الجسم في الرفع.",
      why:"شد مستمر على الكتف الجانبي في أسفل الحركة (عكس الدمبل).",
      prog:"زود العدات لـ 20 ثم الوزن.", reg:"Dumbbell Lateral Raise."}),
    DayEx({id:"overhead-db-extension", stabilizers:"Core",
      sets:"3×10-12", tempo:"2-0-1", rest:"60 ث", rpe:"RPE 8", cue:"المرفقين ثابتين لفوق، نزول عميق خلف الراس.",
      mistake:"فتح المرفقين للخارج.",
      why:"وضع فوق الرأس بيشغل الراس الطويلة للتراي.",
      prog:"زود الوزن تدريجيًا.", reg:"Overhead Cable Extension."}),
    DayEx({id:"diamond-pushup", stabilizers:"Core",
      sets:"2×لحد قرب الفشل", tempo:"2-0-1", rest:"60 ث", rpe:"RPE 8", cue:"الإيدين تحت الصدر، المرفقين قريبين من الجسم.",
      mistake:"هبوط الحوض.",
      why:"إنهاء بوزن الجسم بيزود حجم التراي من غير معدات.",
      prog:"أضف وزن على الضهر.", reg:"Incline Push-up أو Pushdown."})
  ]
},

dayPullB:{
  title:"يوم السحب — Pull B (Row + Rear Delts)", split:"pull", warmupType:"upper",
  main:[
    DayEx({id:"bent-over-row", stabilizers:"Core, أسفل الظهر",
      sets:"4×6-10", tempo:"2-0-1", rest:"120 ث", rpe:"RPE 8", cue:"جذع مائل حوالي 45° وضهر مستقيم، اسحب البار لسرتك.",
      mistake:"رفع الجذع مع كل عدة (Momentum).",
      why:"أساسي لسمك الظهر كله.",
      prog:"زود الوزن 2.5 كجم.", reg:"Chest-Supported Row لو أسفل الظهر مجهد."}),
    DayEx({id:"lat-pulldown", stabilizers:"Core",
      sets:"3×8-12", tempo:"2-0-2", rest:"90 ث", rpe:"RPE 8", cue:"اسحب بالكوع ناحية الجنب والصدر لقدام، متميلش لورا كتير.",
      mistake:"سحب خلف الرقبة أو هز الجسم.",
      why:"حجم لعرض الظهر بتحكم أعلى من الـ Pull-up.",
      prog:"زود الوزن.", reg:"Assisted Pull-up."}),
    DayEx({id:"seated-cable-row", stabilizers:"أسفل الظهر, Core",
      sets:"3×10-12", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"اسحب لبطنك واعصر لوحي الكتف.",
      mistake:"الميل المبالغ للخلف.",
      why:"سمك الظهر ويوازن شغل الدفع.",
      prog:"زود الوزن.", reg:"مدى أقصر بوزن أخف."}),
    DayEx({id:"reverse-pec-deck", stabilizers:"الظهر العلوي",
      sets:"3×15", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 7", cue:"مرفق مرفوع شوية، افتح للخارج واعصر لوحي الكتف.",
      mistake:"وزن تقيل بيخلي الحركة هز جسم.",
      why:"تحفيز مباشر للكتف الخلفي — يقاوم انحناء الكتف.",
      prog:"زود الوزن تدريجيًا.", reg:"Band Pull Apart."}),
    DayEx({id:"incline-db-curl", stabilizers:"Core",
      sets:"3×10-12", tempo:"3-0-1", rest:"60 ث", rpe:"RPE 8", cue:"الكتف للخلف على المقعد، نزول كامل ومتحكم.",
      mistake:"رفع الكتف لقدام.",
      why:"وضع مشدود للراس الطويلة للباي.",
      prog:"زود الوزن.", reg:"Cable Curl."}),
    DayEx({id:"dumbbell-shrug", stabilizers:"Grip",
      sets:"3×12-15", tempo:"1-1-2", rest:"60 ث", rpe:"RPE 8", cue:"ارفع الكتف لفوق وقف ثانية، من غير لف الكتف.",
      mistake:"لف الكتفين.",
      why:"الترابيز العلوي — بيكمل شكل الظهر والرقبة.",
      prog:"زود الوزن.", reg:"Cable Shrug."})
  ]
},

dayLegsB:{
  title:"يوم الرجل — Legs B (Hinge + Single-leg)", split:"legs", warmupType:"lower",
  main:[
    DayEx({id:"hip-thrust", stabilizers:"Core",
      sets:"4×8-12", tempo:"2-1-1", rest:"90 ث", rpe:"RPE 8", cue:"اعصر الجلوت فوق ثانيتين، الذقن لتحت شوية، من غير تقويس أسفل الظهر.",
      mistake:"الدفع بأسفل الظهر بدل الجلوت.",
      why:"أعلى تفعيل موثق للجلوت — تمرين تصحيحي وتضخيمي لـ APT.",
      prog:"زود الوزن 2.5-5 كجم.", reg:"Glute Bridge."}),
    DayEx({id:"bulgarian-split-squat", stabilizers:"Core, توازن",
      sets:"3×8 لكل رجل", tempo:"2-0-1", rest:"90 ث", rpe:"RPE 8", cue:"ثبات الجسم، الجذع مايل قليلًا لقدام، ركبة الأمام متتعديش الإصبع زيادة.",
      mistake:"ميل الجذع الزايد.",
      why:"أحادي الرجل — بيكشف فرق القوة بين الرجلين.",
      prog:"زود وزن الدمبلز.", reg:"Split Squat عادي.",
      vid:"2C-uNgKwPLE"}),
    DayEx({id:"lying-leg-curl", stabilizers:"",
      sets:"3×10-12", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 8", cue:"اضغط بالكعب، الحوض ملزق بالمقعد.",
      mistake:"رفع الحوض.",
      why:"عزل للهامسترينج بدون حمل على الظهر.",
      prog:"زود الوزن.", reg:"Seated Leg Curl."}),
    DayEx({id:"leg-extension", stabilizers:"",
      sets:"3×12-15", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 8", cue:"ارفع بقوة ووقفة ثانية فوق، انزل ببطء.",
      mistake:"رمي الوزن بسرعة.",
      why:"عزل للكوادز (Rectus Femoris) بدون حمل على الركبة من الأحمال المركبة.",
      prog:"زود الوزن أو العدات.", reg:"Sissy Squat."}),
    DayEx({id:"seated-calf-raise-machine", stabilizers:"",
      sets:"4×12-15", tempo:"2-1-2", rest:"60 ث", rpe:"RPE 8", cue:"مدى كامل ووقفة ثانية في الأسفل.",
      mistake:"حركة قصيرة.",
      why:"الجلوس بيشغل Soleus أكتر.",
      prog:"زود الوزن.", reg:"Single-leg Calf Raise."}),
    DayEx({id:"pallof-press", stabilizers:"Core",
      sets:"2×10 لكل جانب", tempo:"بطيء ومتحكم", rest:"45 ث", rpe:"RPE 6", cue:"ادفع لقدام ببطء وقاوم ميل جسمك للجنب.",
      mistake:"لف الجذع مع الدفع.",
      why:"ثبات جذع مضاد للدوران يحمي أسفل الظهر بعد يوم هينج.",
      prog:"زود مقاومة الكيبل.", reg:"قرب من نقطة التثبيت."})
  ]
}
};

/* ---------------- CORRECTIVE / POSTURE LIBRARY — CONDITION CATALOG ------
 * The library is organized by condition instead of assuming everyone has
 * the same posture issue. Only APT ships with real content (the exact
 * aptEducation/aptLibrary data above, unchanged). The others are declared
 * here so the UI, filtering, and data shape are ready for them, but no
 * exercise content was invented for conditions this task didn't cover —
 * they render as an honest "coming soon" state until real content is added.
 * ------------------------------------------------------------------- */
const CORRECTIVE_CONDITIONS = [
  { key:"apt", label:"Anterior Pelvic Tilt (APT)", ar:"ميل الحوض الأمامي", available:true,
    intro:"ميل الحوض للأمام لأسفل بسبب عدم توازن بين عضلات مشدودة (مثنيات الورك) وعضلات ضعيفة (البطن والجلوت)." },
  { key:"rounded-shoulders", label:"Rounded Shoulders", ar:"انحناء الكتفين للأمام", available:true,
    intro:"ميل الكتفين للأمام والداخل بسبب عدم توازن بين عضلات مشدودة (الصدر والكتف الأمامي) وعضلات ضعيفة (أعلى الظهر والكتف الخلفي)." },
  { key:"forward-head", label:"Forward Head Posture", ar:"تقدّم الرأس للأمام", available:false,
    intro:"مكتبة تصحيحية لتقدّم الرأس للأمام (Tech Neck) — هتضاف قريبًا." },
  { key:"kyphosis", label:"Kyphosis", ar:"تحدّب أعلى الظهر", available:false,
    intro:"مكتبة تصحيحية لتحدّب/انحناء أعلى الظهر — هتضاف قريبًا." }
];

/* ---------------- RECOVERY CONTENT ---------------- */
const RECOVERY = {
  cards:[
    {title:`${icon("moon")} توصيات النوم`, body:"7-9 ساعات نوم يوميًا. النوم أهم عامل استشفاء عضلي وهرموني — قلة النوم بتقلل تخليق البروتين العضلي وبتزود الكورتيزول."},
    {title:`${icon("trending-down")} دليل الـ Deload`, body:"كل 5-6 أسابيع تدريب متواصل (تقريبًا 15-18 جلسة على برنامج 3 أيام/أسبوع)، خد أسبوع بحمل أخف (60-70% من أوزانك المعتادة) عشان تسمح للجسم يستشفي بالكامل ويمنع الإصابة والإرهاق — التطبيق هيفكرك تلقائيًا لما توصل للتوقيت ده (شوف صفحة Program)."},
    {title:`${icon("meditate")} جدول الإطالة`, body:"إطالة عامة 10 دقايق بعد كل تمرين (موجودة في نهاية كل يوم تلقائيًا)، وكمان روتين مرونة كامل للجسم 15-20 دقيقة في أيام الراحة (تحت) — استخدمه في يوم الكورس مثلًا بدل ما يبقى راحة كاملة صفر حركة."},
    {title:`${icon("target")} Foam Rolling`, body:"5-10 دقايق على العضلات المشدودة (خصوصًا Hip Flexors, Quads, أسفل الظهر, الصدر) قبل أو بعد التمرين — بيساعد على تقليل الشد العضلي."},
    {title:`${icon("footprints")} المشي اليومي`, body:"7000-10000 خطوة يوميًا بتساعد في الاستشفاء (Active Recovery) وتحسين الدورة الدموية من غير إجهاد إضافي."},
    {title:`${icon("dumbbell")} السباحة كاستشفاء نشط`, body:"يومين السباحة عندك مش لازم يبقوا شدة قصوى دايمًا — سباحة هادئة/تقنية بعد يوم رفع تقيل بتساعد الدورة الدموية والاستشفاء أكتر من ما بتزود التعب، على عكس سباحة سرعة قصوى في نفس اليوم."}
  ],
  checklist:[
    "نمت 7 ساعات على الأقل امبارح",
    "شربت مياه كفاية النهارده",
    "معملتش نفس المجموعة العضلية يومين على بعض",
    "حاسس إن الفورم بتاعك ثابت مش بيسوء",
    "مفيش ألم مفصلي (بس تعب عضلي عادي)"
  ],
  // Standalone 15-20 min whole-body flexibility session — separate from the
  // 2-item auto-rotated warm-up mobility/cool-down (mobility.full/coolDown.full
  // above). Meant for a rest/low-activity day (e.g. Amir's 2 "course" days)
  // so recovery time is used for tissue quality instead of zero movement.
  // Every item is a static hold — no dynamic/CAR drills here on purpose,
  // since the point on a rest day is calming the nervous system down, not
  // warming it up for lifting.
  flexibilityRoutine:[
    {en:"Doorway Chest Stretch", ar:"شد الصدر بالباب", dur:"45 ث لكل جانب", note:"أهم حركة في الروتين ده لتصحيح Rounded Shoulders — كرره 2 مرة.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/209/standing-chest-stretch/", neglected:"الصدر، أكتر عضلة بتقصر من قعدة المكتب وبتسبب Rounded Shoulders."},
    {en:"Cross-Body Shoulder Stretch", ar:"شد الكتف العرضي", dur:"30 ث لكل جانب", note:"اسحب ذراعك بهدوء عبر صدرك بالإيد التانية.", illustration:"https://www.endomondo.com/exercise/cross-body-shoulder-stretch", neglected:"الكتف الخلفي والترابيز العلوي."},
    {en:"Thoracic Extension (Foam Roller)", ar:"فرد أعلى الظهر بالفوم رولر", dur:"8-10 حركات ببطء", note:"يفك تحدّب أعلى الظهر المصاحب لانحناء الكتف.", illustration:"https://www.healthline.com/health/roller-foam-for-back", neglected:"تحدّب أعلى الظهر (Kyphosis)، بيتهمل غالبًا لصالح إطالة أسفل الظهر بس."},
    {en:"Kneeling Hip Flexor Stretch", ar:"شد مثني الورك جاثي", dur:"45 ث لكل رجل", note:"أهم حركة ضد APT في الروتين ده — كرره 2 مرة.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/142/kneeling-hip-flexor-stretch/", neglected:"Hip Flexors، بتقصر بسبب الجلوس الطويل وبتسبب APT."},
    {en:"Seated Hamstring Stretch", ar:"شد الهامسترينج قاعد", dur:"30 ث لكل رجل", note:"رجل مفرودة قدامك، ميل جذعك لقدام من الورك بضهر مستقيم.", illustration:"https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848", neglected:"الهامسترينج، بيتشد قليل عند اللي بيركزوا على الكوادز بس."},
    {en:"Figure-4 Glute Stretch", ar:"شد الجلوت (فيجر 4)", dur:"30 ث لكل جانب", note:"استلقي وحط كاحلك فوق الركبة التانية، اسحب الرجل السفلية لصدرك.", illustration:"https://www.rehabhero.ca/exercise/figure-4-stretch", neglected:"الجلوت والـ Piriformis، بيتهمل قدام إطالة أسفل الظهر."},
    {en:"90/90 Hip Rotation (Static Hold)", ar:"وقفة 90/90", dur:"30 ث لكل جانب", note:"وقفة ثابتة بدل الحركة الديناميكية — تحسين مدى دوران الورك.", illustration:"https://www.healthline.com/health/hip-exercises", neglected:"الدوران الداخلي/الخارجي للورك في وضع ثابت بدل الحركة الديناميكية."},
    {en:"Lat Stretch", ar:"شد اللاتس", dur:"30 ث لكل جانب", note:"امسك حاجة ثابتة فوقك واسند بوزن جسمك للخلف والجانب.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/198/90-lat-stretch/", neglected:"اللاتس، بيتهمل مع التركيز على تمارين الصدر والكتف."},
    {en:"Child's Pose", ar:"وضعية الطفل", dur:"60 ث", note:"يفك أسفل وأعلى الظهر مع بعض ويهدي الجهاز العصبي — ختام مثالي للروتين.", illustration:"https://www.acefitness.org/resources/everyone/exercise-library/227/childs-pose/", neglected:"أسفل الظهر والجهاز العصبي — إطالة ختامية لتهدئة الجسم."}
  ]
};

/* ---------------- NUTRITION CONTENT ---------------- */
const NUTRITION = {
  supplements:[
    {name:"Creatine Monohydrate", tier:"High", note:"الأكثر بحثًا علميًا لزيادة القوة والحجم العضلي. 3-5 جم يوميًا بشكل مستمر."},
    {name:"Whey / بروتين مصل اللبن", tier:"High", note:"وسيلة عملية للوصول لاحتياجك اليومي من البروتين."},
    {name:"Caffeine / كافيين", tier:"High", note:"يحسن الأداء والتركيز، 3-6 مجم/كجم قبل التمرين بـ 45-60 دقيقة."},
    {name:"Beta-Alanine", tier:"Moderate", note:"مفيد للتمارين عالية التكرار (12+ عدة)، ممكن يسبب وخز خفيف في الجلد."},
    {name:"Citrulline Malate", tier:"Moderate", note:"دعم بسيط للتحمل العضلي والـ Pump."},
    {name:"BCAA منفصلة", tier:"Limited", note:"فايدة إضافية محدودة لو أصلاً بتاخد بروتين كافي في يومك."}
  ]
};

/* ---------------- INJURY / PAIN GUIDE ---------------- */
const INJURY = [
  {area:`${colorDot("blue")} الكتف`, cause:"غالبًا إجهاد زائد في تمارين الدفع فوق الرأس أو ضعف Rotator Cuff.",
    avoid:"Overhead Press الثقيل، Dips العميق.", alt:"Landmine Press، Push-up على مدى مريح.",
    mobility:"Band External Rotation، Wall Slides.", recovery:"راحة نسبية 3-5 أيام، Ice لو فيه التهاب حاد، واستشر مختص لو الألم مستمر أكتر من أسبوعين."},
  {area:`${colorDot("green")} الركبة`, cause:"غالبًا زيادة حمل مفاجئة أو فورم غلط في السكوات/اللانج (الركبة بتتعدى الإصبع بشكل مبالغ فيه).",
    avoid:"Deep Squat بوزن تقيل، Jumping Lunges.", alt:"Leg Press بمدى مريح، Box Squat.",
    mobility:"Hip CARs، 90/90 Mobility (المشكلة غالبًا من الورك مش الركبة نفسها).", recovery:"راحة، تقليل الحمل مؤقتًا، واستشارة مختص لو فيه تورم أو صوت طقطقة مؤلم."},
  {area:`${colorDot("orange")} أسفل الظهر`, cause:"غالبًا ضعف الكور أو فورم غلط في الـ RDL/Deadlift (تقويس الظهر).",
    avoid:"Deadlift ثقيل، Good Mornings.", alt:"Glute Bridge، Bird Dog، Dead Bug.",
    mobility:"Cat Camel، Hip Flexor Stretch.", recovery:"تجنب الجلوس الطويل، مشي خفيف، واستشارة مختص لو فيه تنميل في الرجل."},
  {area:`${colorDot("purple")} المرفق`, cause:"غالبًا إجهاد تكراري من تمارين الباي/تراي بوزن تقيل أو فورم مش سليم.",
    avoid:"Skull Crushers الثقيل، Curls بوزن زيادة.", alt:"Cable Curl بوزن أخف، Tricep Pushdown بمدى مريح.",
    mobility:"شد خفيف للساعد، Band External Rotation.", recovery:"راحة من التمارين المسببة للألم 1-2 أسبوع، Ice بعد التمرين."},
  {area:`${colorDot("white")} الرسغ`, cause:"غالبًا وضع غلط في تمارين الضغط (Bench Press/Push-up) أو ضعف مرونة الرسغ.",
    avoid:"Push-ups بوزن كامل على راحة اليد المفرودة، Front Squat بقبضة ضيقة.", alt:"استخدام Dumbbells بقبضة محايدة، Push-up handles.",
    mobility:"Wrist Circles وشد خفيف قبل التمرين.", recovery:"راحة، تجنب الحمل المباشر على الرسغ مؤقتًا، رباط داعم لو محتاج."}
];


// Maps each corrective condition `key` to its education/library content in
// DATA, so corrective.js can render any available condition generically
// instead of hardcoding DATA.aptEducation/aptLibrary for every condition.
const CONDITION_CONTENT = {
  "apt": { edu:"aptEducation", lib:"aptLibrary" },
  "rounded-shoulders": { edu:"roundedShouldersEducation", lib:"roundedShouldersLibrary" }
};

export { DATA, RECOVERY, NUTRITION, INJURY, YT_SEARCH, MW_SEARCH, CORRECTIVE_CONDITIONS, CONDITION_CONTENT };
