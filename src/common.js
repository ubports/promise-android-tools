"use strict";

/*
 * Copyright (C) 2017-2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2017-2022 Johannah Sprinz <hannah@ubports.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Remove falsy values
 * @param {Object} obj object to process
 */
export function removeFalsy(obj) {
  if (typeof obj !== "object" || Array.isArray(obj)) return obj;
  for (var i in obj) {
    if (!obj[i]) {
      delete obj[i];
    } else {
      obj[i] = removeFalsy(obj[i]);
      if (!obj[i]) {
        delete obj[i];
      }
    }
  }
  return Object.keys(obj).length ? obj : null;
}

export function ensureArgIfRequired(args, arg, value, defaultValue) {
  if (value && value !== defaultValue) return setArg(args, arg, value);
  else return removeArg(args, arg);
}

export function setArg(args, arg, value) {
  const i = args.indexOf(arg);
  if (i !== -1) {
    args[i + 1] = value;
  } else {
    args.push(arg, value);
  }
  return args;
}

export function removeArg(args, arg) {
  const i = args.indexOf(arg);
  if (i !== -1) {
    args.splice(i, 2);
  }
  return args;
}
