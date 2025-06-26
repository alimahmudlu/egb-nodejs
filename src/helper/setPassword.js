import bcrypt from "bcryptjs";

const setPassword = password => {
    return bcrypt.hashSync(password, 10);
};

export default setPassword;