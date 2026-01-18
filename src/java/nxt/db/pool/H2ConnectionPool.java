/*
 * Copyright © 2016-2023 Jelurida IP B.V.
 * Copyright © 2023-2025 Jelurida Swiss SA
 *
 * See the LICENSE.txt file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida
 * Swiss SA, no part of this software, including this file, may be copied,
 * modified, propagated, or distributed except according to the terms
 * contained in the LICENSE.txt file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

package nxt.db.pool;

import nxt.util.Logger;
import org.h2.jdbcx.JdbcConnectionPool;

import java.sql.Connection;
import java.sql.SQLException;

public class H2ConnectionPool implements ConnectionPool {
    private JdbcConnectionPool wrappedPool;
    private volatile int maxActiveConnections;

    @Override
    public void initialize(String dbUrl, String dbUsername, String dbPassword, int maxConnections, int loginTimeout) {
        wrappedPool = JdbcConnectionPool.create(dbUrl, dbUsername, dbPassword);
        wrappedPool.setMaxConnections(maxConnections);
        wrappedPool.setLoginTimeout(loginTimeout);
    }

    @Override
    public Connection getConnection() throws SQLException {
        Connection con = wrappedPool.getConnection();
        int activeConnections = wrappedPool.getActiveConnections();
        if (activeConnections > maxActiveConnections) {
            maxActiveConnections = activeConnections;
            Logger.logDebugMessage("Database connection pool current size: " + activeConnections);
        }
        return con;
    }
}
