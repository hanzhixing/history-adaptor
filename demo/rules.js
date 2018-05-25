export default [
    {
        from: {
            key: 'A',
            pattern: '/a/1',
        },
        to: {
            key: 'B',
            pattern: '/b/1',
        },
    },
    {
        from: {
            key: 'A',
            pattern: '/a/2',
        },
        to: {
            key: 'B',
            pattern: '/b/1',
        },
    },
    {
        from: {
            key: 'B',
            pattern: '/b/1',
        },
        to: {
            key: 'A',
            pattern: '/a/1',
        },
    },
    {
        from: {
            key: 'B',
            pattern: '/b/2',
        },
        to: {
            key: 'A',
            pattern: '/a/1',
        },
    },
];
