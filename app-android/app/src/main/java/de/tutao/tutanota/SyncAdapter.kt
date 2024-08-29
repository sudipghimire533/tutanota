package de.tutao.tutanota

import android.accounts.Account
import android.content.AbstractThreadedSyncAdapter
import android.content.ContentProviderClient
import android.content.ContentResolver
import android.content.Context
import android.content.SyncResult
import android.os.Bundle

/**
 * Handle the transfer of data between a server and an
 * app, using the Android sync adapter framework.
 */
class SyncAdapter @JvmOverloads constructor(
	context: Context,
	autoInitialize: Boolean,
	/**
	 * Using a default argument along with @JvmOverloads
	 * generates constructor for both method signatures to maintain compatibility
	 * with Android 3.0 and later platform versions
	 */
	allowParallelSyncs: Boolean = false,
	/*
	 * If your app uses a content resolver, get an instance of it
	 * from the incoming Context
	 */
	val mContentResolver: ContentResolver = context.contentResolver
) : AbstractThreadedSyncAdapter(context, autoInitialize, allowParallelSyncs) {
	/*
 * Specify the code you want to run in the sync adapter. The entire
 * sync adapter runs in a background thread, so you don't have to set
 * up your own background processing.
 */
	override fun onPerformSync(
		account: Account,
		extras: Bundle,
		authority: String,
		provider: ContentProviderClient,
		syncResult: SyncResult
	) {
		/*
		 * Put the data transfer code here.
		 */
	}

	override fun getContext(): Context {
		return super.getContext()
	}
}
