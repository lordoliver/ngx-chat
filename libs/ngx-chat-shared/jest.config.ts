/* eslint-disable */
export default {
    displayName: 'ngx-chat-shared',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    coverageDirectory: '../../coverage/libs/ngx-chat-shared',
};
