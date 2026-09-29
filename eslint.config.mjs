import next from 'eslint-config-next';

const config = [
  ...next,
  {
    rules: {
      // Portraits are private signed URLs, blob URLs or guest data URLs; next/image adds nothing here.
      '@next/next/no-img-element': 'off',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'supabase/**', 'next-env.d.ts'] },
];

export default config;
