const LANGUAGE_ALIASES = {
	en: 'eng',
	eng: 'eng',
	es: 'spa',
	spa: 'spa',
	fr: 'fra',
	fra: 'fra',
	de: 'deu',
	deu: 'deu',
	it: 'ita',
	ita: 'ita',
	pt: 'por',
	por: 'por',
	ja: 'jpn',
	jpn: 'jpn',
	ko: 'kor',
	kor: 'kor',
	zh: 'zho',
	zho: 'zho'
};

export const normalizeLanguageCode = (value) => {
	if (!value || typeof value !== 'string') return '';
	const normalized = value.trim().toLowerCase();
	if (!normalized || normalized === 'unknown' || normalized === 'und') return '';
	const primary = normalized.split(/[-_]/)[0];
	return LANGUAGE_ALIASES[primary] || primary;
};

export const findPreferredAudioStream = (audioStreams, preferredLanguage) => {
	const preferred = normalizeLanguageCode(preferredLanguage);
	if (!preferred || !Array.isArray(audioStreams) || audioStreams.length === 0) return null;
	return audioStreams.find((stream) => normalizeLanguageCode(stream.language) === preferred) || null;
};
