// Shared edge color palette used by canvas edge mapping.
export const KIND_COLORS = {
  initial: '#00C870',
  approval: '#E5B04C',
  exception: '#FF5B73',
  technical: '#43BFD0',
  terminal: '#A78CFF',
  standard: '#7EA7D4',
};

const SEMANTIC_MAP = [
  { color: '#22C55E', pattern: /approv|accept|confirm|grant|authoris|authoriz|activat|sign(?:ed|ing)?(?!\s*off)|pass\b/i },
  { color: '#EF4444', pattern: /reject|declin|den(y|ied|ies)|refus|discard|terminat|void|cancel(?!l?ation)/i },
  { color: '#F59E0B', pattern: /return|send.?back|rework|revis|revert|bounce|recall|push.?back/i },
  { color: '#F97316', pattern: /escalat|after\s*\d|timeout|overdu/i },
  { color: '#60A5FA', pattern: /review|refer|inspect|exception|flag|audit|check/i },
  { color: '#A855F7', pattern: /complet|finish|done|post(?:ed)?|paid|clos(?:e|ed)|archiv/i },
];

function detectSemantic(label, eventType) {
  const text = `${label || ''} ${eventType || ''}`;
  for (const sem of SEMANTIC_MAP) {
    if (sem.pattern.test(text)) return sem;
  }
  return null;
}

export function resolveEdgeColor(label, eventType, sourceKind) {
  const sem = detectSemantic(label, eventType);
  return sem ? sem.color : (KIND_COLORS[sourceKind] || KIND_COLORS.standard);
}
