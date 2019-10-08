export interface User { id: string; }

import { createParamDecorator } from '@nestjs/common';

export const User = createParamDecorator((data, req) => {
  const user = req.user as User;
  return user;
});
