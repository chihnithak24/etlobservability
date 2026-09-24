/**
 * Internationalization (i18n), Text-to-Speech (TTS), and Speech-to-Text (STT) Utilities
 * Supports: English ('en'), Hindi ('hi'), Telugu ('te')
 */

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧', speechLang: 'en-US' },
  { code: 'hi', label: 'हिंदी',    flag: '🇮🇳', speechLang: 'hi-IN' },
  { code: 'te', label: 'తెలుగు',  flag: '🇮🇳', speechLang: 'te-IN' },
];

export const DICTIONARY = {
  en: {
    pageTitle: "AI Failure Prediction",
    pageSubtitle: "Predict ETL job failure risk using CPU, memory, retry count, execution time, data volume & job history",
    jobParameters: "Job Parameters",
    jobName: "Job Name",
    jobNameHint: "(optional — used for history analysis)",
    cpuUsage: "CPU Usage",
    memoryUsage: "Memory Usage",
    retryCount: "Retry Count",
    executionTime: "Execution Time",
    recordsProcessed: "Records Processed",
    sourceSystem: "Source System",
    runPrediction: "Run AI Prediction",
    analyzing: "AI is thinking...",
    predictionResult: "Prediction Result",
    riskScore: "Risk Score",
    confidence: "confidence",
    storedMongo: "Stored in MongoDB",
    recommendedAction: "Recommended Action",
    featureContributions: "Feature Contributions",
    pointsTowardsRisk: "points towards risk score",
    rootCauseAnalysis: "Root Cause Analysis",
    recoveryActions: "Recovery Actions",
    anomaliesDetected: "Anomalies Detected",
    atRiskJobs: "At-Risk & Likely-Fail Jobs",
    recentPredictions: "Recent Predictions",
    listenVoice: "Listen Voice",
    stopVoice: "Stop Voice",
    micSpeak: "Speak Prompt",
    listening: "Listening...",
    assistantTitle: "ETL Assistant",
    assistantWelcome: "Hello! I am your ETL Assistant. Ask me about running jobs, high-risk pipelines, Airflow connectivity, or recovery recommendations.",
    typePrompt: "Ask ETL Assistant...",
    statusLabels: {
      likely_fail: "Likely Fail",
      at_risk: "At Risk",
      stable: "Stable",
      Failed: "Failed",
      Warning: "Warning",
      Success: "Success"
    }
  },
  hi: {
    pageTitle: "एआई विफलता भविष्यवाणी",
    pageSubtitle: "सीपीयू, मेमोरी, रीट्राई काउंट, निष्पादन समय और डेटा वॉल्यूम का उपयोग करके ईटीएल विफलता जोखिम का अनुमान लगाएं",
    jobParameters: "जॉब मापदंड",
    jobName: "जॉब का नाम",
    jobNameHint: "(वैकल्पिक — इतिहास विश्लेषण के लिए प्रयोग किया जाता है)",
    cpuUsage: "सीपीयू उपयोग (CPU)",
    memoryUsage: "मेमोरी उपयोग (Memory)",
    retryCount: "पुनः प्रयास संख्या (Retry Count)",
    executionTime: "निष्पादन समय (Execution Time)",
    recordsProcessed: "संसाधित रिकॉर्ड्स (Records)",
    sourceSystem: "स्रोत प्रणाली (Source)",
    runPrediction: "एआई भविष्यवाणी चलाएं",
    analyzing: "एआई सोच रहा है...",
    predictionResult: "भविष्यवाणी परिणाम",
    riskScore: "जोखिम स्कोर",
    confidence: "विश्वास स्तर",
    storedMongo: "मोंगोडीबी में सहेजा गया",
    recommendedAction: "अनुशंसित कार्रवाई",
    featureContributions: "सुविधा योगदान",
    pointsTowardsRisk: "जोखिम अंक",
    rootCauseAnalysis: "मूल कारण विश्लेषण",
    recoveryActions: "पुनर्प्राप्ति कार्रवाई",
    anomaliesDetected: "अनियमितताएं पाई गईं",
    atRiskJobs: "जोखिम वाले और विफल होने योग्य जॉब्स",
    recentPredictions: "हाल की भविष्यवाणियां",
    listenVoice: "आवाज सुनें",
    stopVoice: "आवाज बंद करें",
    micSpeak: "बोलें (माइक)",
    listening: "सुन रहा है...",
    assistantTitle: "ईटीएल सहायक (ETL Assistant)",
    assistantWelcome: "नमस्ते! मैं आपका ईटीएल ऑब्जर्वेबिलिटी असिस्टेंट हूं। मुझसे रनिंग जॉब्स, उच्च-जोखिम वाली पाइपलाइनों या एयरफ्लो स्थिति के बारे में पूछें।",
    typePrompt: "ईटीएल सहायक से पूछें...",
    statusLabels: {
      likely_fail: "संभावित विफलता",
      at_risk: "जोखिम में",
      stable: "स्थिर",
      Failed: "विफल (Failed)",
      Warning: "चेतावनी (Warning)",
      Success: "सफल (Success)"
    }
  },
  te: {
    pageTitle: "AI వైఫల్య అంచనా",
    pageSubtitle: "CPU, మెమరీ, రీట్రై సంఖ్య, సమయం మరియు డేటా పరిమాణాన్ని ఉపయోగించి ETL వైఫల్యాన్ని అంచనా వేయండి",
    jobParameters: "జాబ్ పారామితులు",
    jobName: "జాబ్ పేరు",
    jobNameHint: "(ఐచ్ఛికం — చరిత్ర విశ్లేషణ కోసం ఉపయోగించబడుతుంది)",
    cpuUsage: "CPU వినియోగం",
    memoryUsage: "మెమరీ వినియోగం",
    retryCount: "మళ్లీ ప్రయత్నించిన సంఖ్య (Retries)",
    executionTime: "నిర్వహణ సమయం (Duration)",
    recordsProcessed: "ప్రాసెస్ చేసిన రికార్డులు",
    sourceSystem: "మూల వ్యవస్థ (Source)",
    runPrediction: "AI అంచనాను రన్ చేయండి",
    analyzing: "AI ఆలోచిస్తోంది...",
    predictionResult: "అంచనా ఫలితం",
    riskScore: "ప్రమాద స్కోరు (Risk Score)",
    confidence: "నమ్మకమైన శాతం",
    storedMongo: "MongoDB లో భద్రపరచబడింది",
    recommendedAction: "సిఫార్సు చేసిన చర్య",
    featureContributions: "ఫీచర్ సహకారాలు",
    pointsTowardsRisk: "ప్రమాద స్కోర్ పాయింట్లు",
    rootCauseAnalysis: "మూల కారణ విశ్లేషణ",
    recoveryActions: "రికవరీ చర్యలు",
    anomaliesDetected: "గుర్తించిన క్రమరాహిత్యాలు",
    atRiskJobs: "ప్రమాదంలో ఉన్న జాబ్‌లు",
    recentPredictions: "ఇటీవలి అంచనాలు",
    listenVoice: "వాయిస్ వినండి",
    stopVoice: "వాయిస్ ఆపండి",
    micSpeak: "మాట్లాడండి (మైక్)",
    listening: "వింటోంది...",
    assistantTitle: "ETL అసిస్టెంట్ (ETL Assistant)",
    assistantWelcome: "నమస్కారం! నేను మీ ETL అసిస్టెంట్‌ని. నడుస్తున్న జాబ్‌లు, ప్రమాదంలో ఉన్న పైప్‌లైన్‌లు లేదా ఎయిర్‌ఫ్లో పరిస్థితి గురించి నన్ను అడగండి.",
    typePrompt: "ETL అసిస్టెంట్‌ని అడగండి...",
    statusLabels: {
      likely_fail: "విఫలమయ్యే అవకాశం ఉంది",
      at_risk: "ప్రమాదంలో ఉంది",
      stable: "స్థిరంగా ఉంది",
      Failed: "విఫలమైంది (Failed)",
      Warning: "హెచ్చరిక (Warning)",
      Success: "విజయం (Success)"
    }
  }
};

/** Translate string by key */
export const t = (key, lang = 'en') => {
  const dict = DICTIONARY[lang] || DICTIONARY.en;
  return dict[key] || DICTIONARY.en[key] || key;
};

/** Helper to translate text dynamically for prediction outputs */
export const translateDynamicText = (text, targetLang = 'en') => {
  if (!text || targetLang === 'en') return text;

  // Translation mappings for common root cause & recovery action phrases
  if (targetLang === 'hi') {
    return text
      .replace(/High resource utilization/gi, "उच्च संसाधन उपयोग")
      .replace(/combined with/gi, "के साथ मिलकर")
      .replace(/retries signals systemic pipeline failure/gi, "पुनः प्रयास प्रणालीगत विफलता का संकेत देते हैं")
      .replace(/Moderate risk/gi, "मध्यम जोखिम")
      .replace(/approaching thresholds that previously caused failures/gi, "उन सीमाओं के करीब जो पहले विफलताओं का कारण बनी थीं")
      .replace(/Job parameters are within safe operating ranges/gi, "जॉब मापदंड सुरक्षित संचालन सीमाओं के भीतर हैं")
      .replace(/Risk is low/gi, "जोखिम कम है")
      .replace(/Scale up compute resources immediately/gi, "कंप्यूट संसाधनों को तुरंत बढ़ाएं")
      .replace(/Increase memory allocation before retry/gi, "पुनः प्रयास करने से पहले मेमोरी आवंटन बढ़ाएं")
      .replace(/Investigate root cause before any further retries/gi, "आगे के प्रयासों से पहले मूल कारण की जांच करें")
      .replace(/Split the job into smaller batches to reduce execution time/gi, "निष्पादन समय घटाने के लिए काम को छोटे बैचों में विभाजित करें")
      .replace(/Enable incremental load or partition the dataset/gi, "डेटासेट को विभाजित करें या वृद्धिशील लोड सक्षम करें")
      .replace(/No immediate action required/gi, "किसी तत्काल कार्रवाई की आवश्यकता नहीं है")
      .replace(/Critical CPU spike/gi, "गंभीर सीपीयू स्पाइक")
      .replace(/Memory near exhaustion/gi, "मेमोरी समाप्ति के करीब")
      .replace(/Excessive retry loop/gi, "अत्यधिक पुनः प्रयास चक्र")
      .replace(/Abnormally long execution/gi, "असामान्य रूप से लंबा निष्पादन")
      .replace(/Record volume approaching system limit/gi, "रिकॉर्ड वॉल्यूम सिस्टम सीमा के करीब");
  }

  if (targetLang === 'te') {
    return text
      .replace(/High resource utilization/gi, "అధిక వనరుల వినియోగం")
      .replace(/combined with/gi, "మరియు")
      .replace(/retries signals systemic pipeline failure/gi, "రీట్రైల వలన పైప్‌లైన్ వైఫల్యం సంభవించవచ్చు")
      .replace(/Moderate risk/gi, "మధ్యస్థ ప్రమాదం")
      .replace(/approaching thresholds that previously caused failures/gi, "గతంలో వైఫల్యాలకు కారణమైన పరిమితులకు చేరుకుంటోంది")
      .replace(/Job parameters are within safe operating ranges/gi, "జాబ్ పారామితులు సురక్షిత పరిమితిలో ఉన్నాయి")
      .replace(/Risk is low/gi, "ప్రమాదం తక్కువగా ఉంది")
      .replace(/Scale up compute resources immediately/gi, "వెంటనే కంప్యూట్ వనరులను (CPU) పెంచండి")
      .replace(/Increase memory allocation before retry/gi, "మళ్లీ ప్రయత్నించే ముందు మెమరీ కేటాయింపును పెంచండి")
      .replace(/Investigate root cause before any further retries/gi, "మరిన్ని ప్రయత్నాలకు ముందు మూల కారణాన్ని తనిఖీ చేయండి")
      .replace(/Split the job into smaller batches to reduce execution time/gi, "సమయాన్ని తగ్గించడానికి జాబ్‌ను చిన్న బ్యాచ్‌లుగా విభజించండి")
      .replace(/Enable incremental load or partition the dataset/gi, "డేటాసెట్‌ను విభజించండి లేదా ఇన్‌క్రిమెంటల్ లోడ్‌ను ప్రారంభించండి")
      .replace(/No immediate action required/gi, "తక్షణ చర్య ఏదీ అవసరం లేదు")
      .replace(/Critical CPU spike/gi, "తీవ్రమైన CPU సమస్య")
      .replace(/Memory near exhaustion/gi, "మెమరీ దాదాపు పూర్తయింది")
      .replace(/Excessive retry loop/gi, "ఎక్కువ రీట్రై లూప్స్")
      .replace(/Abnormally long execution/gi, "అసాధారణమైన సుదీర్ఘ సమయం")
      .replace(/Record volume approaching system limit/gi, "డేటా రికార్డుల పరిమితి గరిష్టానికి చేరుకుంటోంది");
  }

  return text;
};

/** Speech Synthesis (Text-to-Speech) */
export const speakText = (text, lang = 'en', onStart = () => {}, onEnd = () => {}, onError = () => {}) => {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    onError('Speech synthesis is not supported in your browser.');
    return null;
  }

  window.speechSynthesis.cancel(); // Reset active speech

  const cleanText = text
    .replace(/[*_#`~]/g, '')
    .replace(/•/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();

  if (!cleanText) {
    onEnd();
    return null;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const langMap = { en: 'en-US', hi: 'hi-IN', te: 'te-IN' };
  const targetLangCode = langMap[lang] || 'en-US';
  utterance.lang = targetLangCode;
  utterance.rate = 0.95;

  const setVoiceAndSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const matched = voices.find(v =>
      v.lang.replace('_', '-').toLowerCase().startsWith(targetLangCode.toLowerCase()) ||
      v.lang.toLowerCase().startsWith(lang.toLowerCase())
    );
    if (matched) utterance.voice = matched;

    utterance.onstart = onStart;
    utterance.onend = onEnd;
    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        onError('Voice playback interrupted or failed.');
      } else {
        onEnd();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    setVoiceAndSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      setVoiceAndSpeak();
      window.speechSynthesis.onvoiceschanged = null;
    };
    // Fallback if event doesn't trigger quickly
    setTimeout(setVoiceAndSpeak, 100);
  }

  return utterance;
};

export const stopSpeech = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

/** Speech Recognition (Speech-to-Text / Microphone) */
const SPEECH_ERROR_MESSAGES = {
  'no-speech': 'No speech detected. Please speak clearly into your microphone.',
  'not-allowed': 'Microphone permission denied. Please allow microphone access in browser settings.',
  'audio-capture': 'No microphone found. Please connect a microphone and try again.',
  'network': 'Network error during speech recognition. Please check your connection.',
  'aborted': 'Voice input stopped.',
  'service-not-allowed': 'Speech recognition service is disabled or blocked in browser settings.',
};

export const startVoiceRecognition = (lang = 'en', onResult, onError, onEnd) => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (onError) onError('Speech recognition is not supported in this browser. Please try Google Chrome or MS Edge.');
    return null;
  }

  try {
    const recognition = new SpeechRecognition();
    const langMap = { en: 'en-US', hi: 'hi-IN', te: 'te-IN' };
    recognition.lang = langMap[lang] || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let hasResult = false;

    recognition.onresult = (event) => {
      hasResult = true;
      const transcript = event.results[0][0].transcript;
      if (onResult && transcript) onResult(transcript);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition event error:', event.error);
      const userFriendlyMsg = SPEECH_ERROR_MESSAGES[event.error] || `Microphone error: ${event.error}`;
      if (event.error !== 'aborted' && onError) {
        onError(userFriendlyMsg);
      }
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    recognition.start();
    return recognition;
  } catch (err) {
    console.error('Failed to initialize speech recognition:', err);
    if (onError) onError(`Could not start microphone: ${err.message || err}`);
    if (onEnd) onEnd();
    return null;
  }
};
