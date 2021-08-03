export default class Logger
{
	constructor(prefix)
	{
		this.debug = console.debug.bind(this);
		this.warn = console.warn.bind(this);
		this.error = console.error.bind(this);
	}
}
