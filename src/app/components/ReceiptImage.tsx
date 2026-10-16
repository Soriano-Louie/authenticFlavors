import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, receiptEndpoint } from '../api/apiFetch';

export function ReceiptImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const { accessToken } = useAuth();
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    const controller = new AbortController();
    setUrl(undefined);
    setFailed(false);
    if (src && accessToken) {
      Promise.resolve().then(() => apiFetch(receiptEndpoint(src), {
        headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
      })).then(async response => {
        if (!response.ok) throw new Error('Receipt unavailable');
        const blob = await response.blob();
        if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
      }).catch(() => { if (active) setFailed(true); });
    }
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, accessToken]);
  if (!url) return <span role="status">{failed ? 'Unable to load receipt. Please try again.' : 'Loading receipt…'}</span>;
  return <img {...props} src={url} />;
}
