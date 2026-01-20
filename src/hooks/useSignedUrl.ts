import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to get a signed URL for a private storage object
 * @param bucket - The storage bucket name
 * @param path - The path to the file within the bucket (or full public URL)
 * @param expiresIn - How long the signed URL should be valid (in seconds, default 1 hour)
 */
export function useSignedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresIn: number = 3600
) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSignedUrl(null);
      return;
    }

    // Extract the actual file path from a full URL if needed
    let filePath = path;
    
    // If it's a full Supabase storage URL, extract just the path
    const storageUrlPattern = /\/storage\/v1\/object\/public\/[^/]+\/(.*)/;
    const match = path.match(storageUrlPattern);
    if (match) {
      filePath = match[1];
    }

    // Also handle the new render URL format
    const renderUrlPattern = /\/storage\/v1\/render\/image\/public\/[^/]+\/(.*)/;
    const renderMatch = path.match(renderUrlPattern);
    if (renderMatch) {
      filePath = renderMatch[1];
    }

    const getSignedUrl = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, expiresIn);

        if (signError) {
          console.error('Error creating signed URL:', signError);
          setError(signError.message);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error getting signed URL:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    getSignedUrl();
  }, [bucket, path, expiresIn]);

  return { signedUrl, loading, error };
}

/**
 * Utility function to get a signed URL (for use outside of React components)
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!path) return null;

  // Extract the actual file path from a full URL if needed
  let filePath = path;
  
  const storageUrlPattern = /\/storage\/v1\/object\/public\/[^/]+\/(.*)/;
  const match = path.match(storageUrlPattern);
  if (match) {
    filePath = match[1];
  }

  const renderUrlPattern = /\/storage\/v1\/render\/image\/public\/[^/]+\/(.*)/;
  const renderMatch = path.match(renderUrlPattern);
  if (renderMatch) {
    filePath = renderMatch[1];
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Error getting signed URL:', err);
    return null;
  }
}
