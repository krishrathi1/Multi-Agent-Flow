import { Helmet } from 'react-helmet-async';
import { config } from '../config';

const SITE_NAME = 'MyceliumOps by Blostem';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  keywords?: string;
  ogImage?: string;
  structuredData?: Record<string, unknown>;
  noindex?: boolean;
}

export function SEO({
  title,
  description,
  canonical,
  keywords,
  ogImage = config.defaultOgImage,
  structuredData,
  noindex = false,
}: SEOProps) {
  const fullTitle = title.includes('Blostem') ? title : `${title} | Blostem`;
  const canonicalUrl = canonical ? new URL(canonical, `${config.siteUrl}/`).href : config.siteUrl;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1"
        />
      )}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
