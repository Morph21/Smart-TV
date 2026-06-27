import {createContext, useContext, useState, useEffect, useCallback} from 'react';
import * as seerrApi from '../services/seerrApi';
import {getFromStorage, saveToStorage, removeFromStorage} from '../services/storage';
import {useSettings} from './SettingsContext';

const SeerrContext = createContext(null);

const normalizeMoonfinAuthType = (authType) => (authType === 'local' ? 'local' : 'jellyfin');

export const SeerrProvider = ({children}) => {
const {syncFromServer} = useSettings();
const [isEnabled, setIsEnabled] = useState(false);
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [isLoading, setIsLoading] = useState(true);
const [user, setUser] = useState(null);
const [serverUrl, setServerUrl] = useState(null);
const [isMoonfin, setIsMoonfin] = useState(false);
const [variant, setVariant] = useState('seerr');
const [displayName, setDisplayName] = useState('Seerr');
const [pluginInfo, setPluginInfo] = useState(null);
const [moonfinAuthType, setMoonfinAuthTypeState] = useState('jellyfin');

useEffect(() => {
const init = async () => {
try {
let config = await getFromStorage('seerr');
// Carry over pre-rename data stored under the old 'jellyseerr' key.
if (!config) {
const legacyConfig = await getFromStorage('jellyseerr');
if (legacyConfig) {
config = legacyConfig;
await saveToStorage('seerr', legacyConfig);
}
}
if (config?.moonfin) {
const initialAuthType = normalizeMoonfinAuthType(config.moonfinAuthType);
setMoonfinAuthTypeState(initialAuthType);
seerrApi.setMoonfinConfig(config.jellyfinServerUrl, config.jellyfinAccessToken);
seerrApi.setMoonfinMode(true);
setServerUrl(config.url || config.jellyfinServerUrl);
setIsEnabled(true);
setIsMoonfin(true);

try {
const status = await seerrApi.getMoonfinStatus();
if (status?.authenticated) {
if (status.authType) {
setMoonfinAuthTypeState(normalizeMoonfinAuthType(status.authType));
}
setUser({
displayName: status.displayName,
seerrUserId: status.seerrUserId,
permissions: status.permissions ?? 0xFFFFFFFF
});
setIsAuthenticated(true);
setServerUrl(status.url || config.url || config.jellyfinServerUrl);
}
} catch (e) {
console.log('[Seerr] Moonfin status check failed:', e.message);
}

try {
const [pingResult, configResult] = await Promise.all([
seerrApi.moonfinPing(config.jellyfinServerUrl, config.jellyfinAccessToken).catch(() => null),
seerrApi.getMoonfinConfig(config.jellyfinServerUrl, config.jellyfinAccessToken).catch(() => null)
]);
if (pingResult) {
setPluginInfo(pingResult);
}
if (configResult) {
const v = configResult.variant || 'seerr';
setVariant(v);
setDisplayName(configResult.displayName || 'Seerr');
}
} catch (e) {
console.log('[Seerr] Plugin info fetch failed:', e.message);
}

syncFromServer(config.jellyfinServerUrl, config.jellyfinAccessToken).catch(e =>
console.log('[Seerr] Settings sync failed:', e.message)
);
}
} catch (e) {
console.error('[Seerr] Init failed:', e);
} finally {
setIsLoading(false);
}
};
init();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const configureWithMoonfin = useCallback(async (jellyfinServer, token) => {
const existingConfig = await getFromStorage('seerr');
const savedAuthType = normalizeMoonfinAuthType(existingConfig?.moonfinAuthType);
setMoonfinAuthTypeState(savedAuthType);

seerrApi.setMoonfinConfig(jellyfinServer, token);
seerrApi.setMoonfinMode(true);

const [status, pingResult, configResult] = await Promise.all([
seerrApi.getMoonfinStatus(),
seerrApi.moonfinPing(jellyfinServer, token).catch(() => null),
seerrApi.getMoonfinConfig(jellyfinServer, token).catch(() => null)
]);

if (pingResult) {
setPluginInfo(pingResult);
}
if (configResult) {
const v = configResult.variant || 'seerr';
setVariant(v);
setDisplayName(configResult.displayName || 'Seerr');
}

syncFromServer(jellyfinServer, token).catch(e =>
console.log('[Seerr] Settings sync failed:', e.message)
);

if (status?.authenticated) {
const resolvedAuthType = normalizeMoonfinAuthType(status.authType || savedAuthType);
if (status.authType) {
setMoonfinAuthTypeState(normalizeMoonfinAuthType(status.authType));
}
const userData = {
displayName: status.displayName,
seerrUserId: status.seerrUserId,
permissions: status.permissions ?? 0xFFFFFFFF
};
setUser(userData);
setIsAuthenticated(true);
setServerUrl(status.url || jellyfinServer);
setIsEnabled(true);
setIsMoonfin(true);

await saveToStorage('seerr', {
moonfin: true,
url: status.url || jellyfinServer,
jellyfinServerUrl: jellyfinServer,
jellyfinAccessToken: token,
userId: status.seerrUserId,
moonfinAuthType: resolvedAuthType
});

return {authenticated: true, user: userData, url: status.url};
} else {
setServerUrl(jellyfinServer);
setIsEnabled(true);
setIsMoonfin(true);

await saveToStorage('seerr', {
moonfin: true,
jellyfinServerUrl: jellyfinServer,
jellyfinAccessToken: token,
moonfinAuthType: savedAuthType
});

return {authenticated: false, url: status?.url};
}
}, [syncFromServer]);

const loginWithMoonfin = useCallback(async (username, password, authType = 'jellyfin') => {
const normalizedAuthType = normalizeMoonfinAuthType(authType);
await seerrApi.moonfinLogin(username, password, normalizedAuthType);
const status = await seerrApi.getMoonfinStatus();
if (status?.authenticated) {
const userData = {
displayName: status.displayName,
seerrUserId: status.seerrUserId,
permissions: status.permissions ?? 0xFFFFFFFF
};
setMoonfinAuthTypeState(normalizedAuthType);
const config = await getFromStorage('seerr');
const resolvedUrl = status.url || config?.url || config?.jellyfinServerUrl || null;
setUser(userData);
setIsAuthenticated(true);
setServerUrl(resolvedUrl);

await saveToStorage('seerr', {
...config,
url: resolvedUrl,
userId: status.seerrUserId,
moonfinAuthType: normalizedAuthType
});

return userData;
}
throw new Error('Login succeeded but session not established');
}, []);

const setMoonfinAuthType = useCallback(async (authType) => {
const normalizedAuthType = normalizeMoonfinAuthType(authType);
setMoonfinAuthTypeState(normalizedAuthType);

const config = await getFromStorage('seerr');
if (config?.moonfin) {
await saveToStorage('seerr', {
...config,
moonfinAuthType: normalizedAuthType
});
}
}, []);

const logout = useCallback(async () => {
try { await seerrApi.moonfinLogout(); } catch (e) { void e; }
setUser(null);
setIsAuthenticated(false);

const config = await getFromStorage('seerr');
if (config?.moonfin) {
await saveToStorage('seerr', {
...config,
url: config.jellyfinServerUrl || config.url,
userId: null,
moonfinAuthType: normalizeMoonfinAuthType(config.moonfinAuthType || moonfinAuthType)
});
setServerUrl(config.jellyfinServerUrl || config.url || null);
}
}, [moonfinAuthType]);

const disable = useCallback(async () => {
await removeFromStorage('seerr');
seerrApi.setMoonfinMode(false);
seerrApi.setMoonfinConfig(null, null);
setServerUrl(null);
setUser(null);
setIsEnabled(false);
setIsAuthenticated(false);
setIsMoonfin(false);
setVariant('seerr');
setDisplayName('Seerr');
setPluginInfo(null);
setMoonfinAuthTypeState('jellyfin');
}, []);

return (
<SeerrContext.Provider value={{
isEnabled,
isAuthenticated,
isLoading,
user,
serverUrl,
isMoonfin,
variant,
displayName,
pluginInfo,
moonfinAuthType,
api: seerrApi,
configureWithMoonfin,
loginWithMoonfin,
setMoonfinAuthType,
logout,
disable
}}>
{children}
</SeerrContext.Provider>
);
};

export const useSeerr = () => {
const context = useContext(SeerrContext);
if (!context) {
throw new Error('useSeerr must be used within SeerrProvider');
}
return context;
};
