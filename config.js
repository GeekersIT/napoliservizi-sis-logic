const config = {
    keycloak: {
        url: "https://" + process.env.PUBLIC_URI + "/auth",
        username: process.env.ADMIN_USER,
        password: process.env.ADMIN_PWD,
        realm: process.env.KEYCLOAK_REALM,
        secret: '5eb0a9d3-d6a4-474f-a155-29e3e2a42de2'
    },
    db: {
        url: "https://" + process.env.PUBLIC_URI + "/api/v1/graphql",
    },
    minio: {
        url: process.env.MINIO_SERVICE,
        accessKey: process.env.MINIO_ACCESS,
        secretKey: process.env.MINIO_SECRET
    },
    template: {
        url: "https://" + process.env.MINIO_ACCESS + "/template/"
    },
    protocollo: {
        url: "http://protocollo-service:8080"
    }
};

export default config;