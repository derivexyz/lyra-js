type GenericEnum = { [key: string]: string | number }

export default function coerce<T extends GenericEnum, DefaultValue extends T[keyof T] | undefined>(
  obj: T,
  value: any,
  defaultValue?: DefaultValue
): T[keyof T] | DefaultValue {
  const coercedValue = Object.values(obj).find(
    val => val.toString().toLowerCase() === value?.toString().toLowerCase()
  ) as any
  return coercedValue != null ? coercedValue : defaultValue
}
