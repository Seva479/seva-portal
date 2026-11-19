import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'backups/**/*', 'node_modules/**/*', 'src/**/*', 'public/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
