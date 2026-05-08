interface EvoSendTextResponse {
  key?: {
    id?: string;
  };
  message?: {
    key?: {
      id?: string;
    };
  };
  status?: string;
}

function requireEvoConfig() {
  const apiUrl = process.env.EVO_API_URL?.trim();
  const apiKey = process.env.EVO_API_KEY?.trim();
  const instanceName = process.env.EVO_INSTANCE_NAME?.trim();

  if (!apiUrl || !apiKey || !instanceName) {
    throw new Error('Evo API is not configured.');
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiKey,
    instanceName,
  };
}

function getProviderMessageId(response: EvoSendTextResponse) {
  return response.key?.id ?? response.message?.key?.id ?? null;
}

export async function sendEvoTextMessage(destination: string, text: string) {
  const { apiUrl, apiKey, instanceName } = requireEvoConfig();
  const response = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      number: destination,
      text,
      linkPreview: false,
    }),
  });

  const payload = await response.json().catch(() => ({})) as EvoSendTextResponse & { message?: unknown };

  if (!response.ok) {
    const detail = typeof payload.message === 'string' ? payload.message : response.statusText;
    throw new Error(`Evo API send failed (${response.status}): ${detail}`);
  }

  return {
    providerMessageId: getProviderMessageId(payload),
    status: payload.status ?? null,
  };
}
