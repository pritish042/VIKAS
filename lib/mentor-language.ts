// Reply preference is inferred, while retrieval still requires an exact source language.
export function inferReplyLanguage(message:string,previous='English'){
 const requested=/\b(?:in|speak|reply|answer in)\s+(English|Hindi|Bengali|Odia|Tamil|Telugu|Marathi|Urdu)\b/i.exec(message);
 if(requested)return requested[1][0].toUpperCase()+requested[1].slice(1).toLowerCase();
 if(/[\u0900-\u097f]/.test(message))return 'Hindi';
 if(/[\u0980-\u09ff]/.test(message))return 'Bengali';
 if(/[\u0b00-\u0b7f]/.test(message))return 'Odia';
 if(/[\u0b80-\u0bff]/.test(message))return 'Tamil';
 if(/[\u0c00-\u0c7f]/.test(message))return 'Telugu';
 return /^(yes|next|ok|okay|sure|\d+)[.!?]*$/i.test(message.trim())?previous:'English';
}
export function localMentorReply(message:string){
 const text=message.trim().toLowerCase().replace(/[.!?]+$/,'');
 if(/^(thanks|thank you)$/.test(text))return 'You’re welcome. Say “next” to continue your lesson, or ask about another topic.';
 if(/^(hi|hello|hey|good morning|good evening)$/.test(text))return 'Hello! Ask me to explain a topic, help with code, or plan your next step. If we already started a lesson, say “next” to continue.';
 if(/^(how (can|could) you help me|what can you do|help|product help)$/.test(text))return 'I can explain a topic, walk through code, or help plan a manageable next step. C, C++ and Python basics have reviewed examples and practice. Memory shows your saved context; APRAJITA supports C, Python, HTML and Java editing. What would you like to work on?';
}
