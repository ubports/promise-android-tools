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

/** Remove falsy values from any object */
export function removeFalsy(obj?: {}): any {
  if (typeof obj !== "object" || Array.isArray(obj)) return obj;
  for (const i in obj) {
    if ((Object.getOwnPropertyDescriptor(obj, i) as PropertyDescriptor).get) {
      Object.defineProperty(obj, i, {
        value: removeFalsy(obj[i]),
        writable: true
      });
    }
    if (obj[i]?.trim) obj[i] = obj[i].trim();
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
