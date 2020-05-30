export interface User { id: string; }

import { createParamDecorator } from '@nestjs/common';

export const User = createParamDecorator((data, req) => {
  const user: User = req.user || { id: 'todo: use auth' }; // todo use http://www.passportjs.org/ or so
  return user;
});
