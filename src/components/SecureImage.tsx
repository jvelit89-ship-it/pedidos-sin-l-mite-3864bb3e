import { useSignedUrl } from '@/hooks/useSignedUrl';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SecureImageProps {
  bucket: string;
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  expiresIn?: number;
}

/**
 * A component that displays images from private Supabase storage buckets
 * using signed URLs for secure access.
 */
export function SecureImage({
  bucket,
  path,
  alt,
  className,
  fallback,
  expiresIn = 3600
}: SecureImageProps) {
  const { signedUrl, loading, error } = useSignedUrl(bucket, path, expiresIn);

  if (!path) {
    return fallback ? <>{fallback}</> : null;
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !signedUrl) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
    />
  );
}
