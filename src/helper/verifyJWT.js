import jwt from 'jsonwebtoken';

const verifyJWT = token => {
    return jwt.verify(
        token,
        'N6Lh7zgafuGO72FVaLJYbfygDq6nFAQq'
    );
};

export default verifyJWT;